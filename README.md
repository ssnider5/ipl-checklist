# IPL Checklist

A web application for executing phased IPL (Initial Program Load) and disaster recovery plans. Built for mainframe operations teams who need to run dozens of strictly-ordered tasks across coordinated phases — quiescing subsystems, draining queues, taking dumps, performing the IPL, restarting services, smoke-testing — and need every operator on the conference bridge to see exactly where the run is, in real time, without anyone refreshing a page.

This is the deployed implementation submitted as the term project for an introduction to cloud computing course. It exercises the core building blocks of an AWS production deployment — container images in ECR, two stateless services on ECS Fargate behind an Application Load Balancer, a managed Postgres database in RDS, network isolation via security groups, centralized logging through CloudWatch — while keeping the application itself focused enough to actually be useful. Three technical highlights are worth calling out: a topological task layout where prerequisite relationships are drawn live as SVG curves between cards, real-time status propagation over Server-Sent Events so every connected operator sees state changes as they happen, and server-side prerequisite enforcement using `SELECT ... FOR UPDATE` in Postgres so two operators racing on the same task can't both bypass a guard.

## Architecture

The deployment uses the following AWS services:

- **ECS on Fargate** — Two long-running services in a single cluster: `ipl-server` (Express + TypeScript on port 4000) and `ipl-web` (Next.js on port 3000). Fargate handles task orchestration so there are no EC2 instances to manage.
- **ECR** — Two repositories (`ipl-checklist-server`, `ipl-checklist-web`) hold the container images that the ECS task definitions pull from. Images are pinned with the `linux/amd64` platform to match Fargate's default architecture.
- **RDS Postgres 16** on **db.t4g.micro** — A managed Postgres instance running on Graviton (ARM) for cost efficiency. The backend opens an SSL connection at boot and runs `migrations/init.sql` automatically, so the schema is created idempotently on first start with no manual psql step required.
- **Application Load Balancer** — Internet-facing layer-7 router with path-based forwarding: `/api/*` requests go to the server target group, everything else goes to the web target group. The listener idle timeout is set to 300 seconds, which is essential for keeping Server-Sent Events connections open across the load balancer.
- **VPC with three security-group tiers** — A clean ingress chain where each tier only accepts traffic from the tier in front of it: the ALB SG accepts `:80` from the internet, the ECS task SG accepts `:3000` and `:4000` from the ALB SG only, and the RDS SG accepts `:5432` from the ECS task SG only.
- **CloudWatch Logs** — Two log groups (`/ecs/ipl-checklist-server` and `/ecs/ipl-checklist-web`) capture stdout/stderr from every task container, with a 7-day retention policy applied to keep storage costs bounded.
- **IAM** — A single `ecsTaskExecutionRole` with the AWS-managed `AmazonECSTaskExecutionRolePolicy` is what grants the Fargate agent permission to pull images from ECR and ship logs to CloudWatch.

```
              ┌─────────┐
   Browser ──▶│   ALB   │
              └────┬────┘
                   │
            /  ────┼────  /api/*
            │      │      │
            ▼      ▼      ▼
        ┌───────┐    ┌────────┐
        │ web   │    │ server │   ECS Fargate
        │ task  │    │ task   │
        └───────┘    └───┬────┘
                         │
                         ▼
                    ┌─────────┐
                    │ RDS PG  │
                    └─────────┘
```

## Repository Layout

```
ipl-checklist/
├── server/             Express + TypeScript backend (one ECR image, one ECS service)
├── web/                Next.js 15 + Tailwind frontend (one ECR image, one ECS service)
└── docker-compose.yml  Brings up Postgres + both services for local development
```

The `server/` directory holds the API, the SQL migrations, and the Server-Sent Events bus. The `web/` directory holds the App Router pages, React client components, and a runtime proxy route handler that forwards `/api/*` calls to whatever `API_URL` is set to at request time. The compose file is for local development only and does not participate in the AWS deployment.

## Local Development

Copy the example env files into place and bring up the full stack:

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env
docker compose up --build
```

Then open http://localhost:3000. The first browser request triggers the Next.js initial render, which fetches the plan list from the server container; subsequent client-side actions go through the runtime `/api/*` proxy.

To work on one service at a time without rebuilding the whole stack:

```bash
# terminal 1 — postgres only
docker compose up db

# terminal 2 — backend
cd server && npm install && npm run dev

# terminal 3 — frontend
cd web && npm install && npm run dev
```

## AWS Deployment

The deployment proceeds in five sequential steps. Each step has a one-line summary, the AWS CLI commands needed, and a verification check before moving to the next step. Substitute `<your-account-id>`, `<your-region>`, and the various resource identifiers as you go.

### Step 1 — Push container images to ECR

**Goal:** publish the server and web images to private repositories that ECS can pull from.

```bash
# Create the two repositories
aws ecr create-repository --repository-name ipl-checklist-server --region <your-region>
aws ecr create-repository --repository-name ipl-checklist-web    --region <your-region>

# Authenticate the local Docker daemon to ECR (token is valid 12 hours)
aws ecr get-login-password --region <your-region> \
  | docker login --username AWS --password-stdin \
      <your-account-id>.dkr.ecr.<your-region>.amazonaws.com

# Build for Fargate's amd64 architecture
docker build --platform linux/amd64 -t ipl-checklist-server ./server
docker build --platform linux/amd64 -t ipl-checklist-web    ./web

# Tag and push
docker tag ipl-checklist-server:latest \
  <your-account-id>.dkr.ecr.<your-region>.amazonaws.com/ipl-checklist-server:latest
docker tag ipl-checklist-web:latest \
  <your-account-id>.dkr.ecr.<your-region>.amazonaws.com/ipl-checklist-web:latest

docker push <your-account-id>.dkr.ecr.<your-region>.amazonaws.com/ipl-checklist-server:latest
docker push <your-account-id>.dkr.ecr.<your-region>.amazonaws.com/ipl-checklist-web:latest
```

**Verify:** `aws ecr list-images --repository-name ipl-checklist-server --region <your-region>` should report a `latest`-tagged image digest in each repository.

### Step 2 — Provision the RDS database

**Goal:** create a managed Postgres 16 instance the backend can connect to. The backend runs `migrations/init.sql` on startup, so no manual SQL is needed once the instance is reachable.

```bash
# A security group for RDS — port 5432 ingress is opened in step 3
aws ec2 create-security-group \
  --group-name ipl-rds-sg \
  --description "RDS Postgres for ipl-checklist" \
  --region <your-region>

aws rds create-db-instance \
  --db-instance-identifier ipl-checklist-db \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 16.13 \
  --master-username ipladmin \
  --master-user-password <strong-generated-password> \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids <rds-sg-id> \
  --no-publicly-accessible \
  --no-multi-az \
  --db-name ipl \
  --region <your-region>

aws rds wait db-instance-available \
  --db-instance-identifier ipl-checklist-db \
  --region <your-region>
```

**Verify:** `aws rds describe-db-instances --db-instance-identifier ipl-checklist-db --query "DBInstances[0].Endpoint.Address" --output text` returns a hostname. Save it — it goes into `DATABASE_URL` in step 5.

### Step 3 — Configure VPC security groups

**Goal:** isolate each tier so it only accepts traffic from the tier in front of it. Three security groups are involved.

```bash
# ALB SG — port 80 from the internet
aws ec2 create-security-group --group-name ipl-alb-sg \
  --description "ALB for ipl-checklist" --vpc-id <vpc-id>

aws ec2 authorize-security-group-ingress \
  --group-id <alb-sg-id> --protocol tcp --port 80 --cidr 0.0.0.0/0

# ECS task SG — ports 3000 and 4000 from the ALB SG only
aws ec2 create-security-group --group-name ipl-ecs-sg \
  --description "ECS tasks for ipl-checklist" --vpc-id <vpc-id>

aws ec2 authorize-security-group-ingress \
  --group-id <ecs-sg-id> --protocol tcp --port 3000 --source-group <alb-sg-id>
aws ec2 authorize-security-group-ingress \
  --group-id <ecs-sg-id> --protocol tcp --port 4000 --source-group <alb-sg-id>

# RDS SG — port 5432 from the ECS task SG only
aws ec2 authorize-security-group-ingress \
  --group-id <rds-sg-id> --protocol tcp --port 5432 --source-group <ecs-sg-id>
```

**Verify:** `aws ec2 describe-security-groups --group-ids <alb-sg-id> <ecs-sg-id> <rds-sg-id>` shows each ingress rule scoped only to the source it should accept from. No SG should accept `0.0.0.0/0` except the ALB SG on port 80.

### Step 4 — Stand up the Application Load Balancer

**Goal:** create the public entrypoint and the path-based routing rules. The ALB needs at least two subnets in different availability zones.

```bash
# Create the load balancer across two AZs
aws elbv2 create-load-balancer \
  --name ipl-alb \
  --subnets <subnet-az-a> <subnet-az-b> \
  --security-groups <alb-sg-id> \
  --scheme internet-facing --type application

# Bump idle timeout for SSE — the backend heartbeats every 25s; 300s gives slack
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn <alb-arn> \
  --attributes Key=idle_timeout.timeout_seconds,Value=300

# Two target groups for IP targets (Fargate uses awsvpc networking)
aws elbv2 create-target-group --name ipl-web-tg \
  --protocol HTTP --port 3000 --vpc-id <vpc-id> --target-type ip \
  --health-check-path / --health-check-interval-seconds 15

aws elbv2 create-target-group --name ipl-server-tg \
  --protocol HTTP --port 4000 --vpc-id <vpc-id> --target-type ip \
  --health-check-path /health --health-check-interval-seconds 15

# Listener — default action sends to web TG
aws elbv2 create-listener --load-balancer-arn <alb-arn> \
  --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn=<web-tg-arn>

# Higher-priority rule sends /api/* to server TG
aws elbv2 create-rule --listener-arn <listener-arn> --priority 10 \
  --conditions Field=path-pattern,Values=/api/* \
  --actions Type=forward,TargetGroupArn=<server-tg-arn>
```

**Verify:** `aws elbv2 describe-load-balancers --names ipl-alb --query "LoadBalancers[0].DNSName"` returns the public DNS name. That value is the `ALB_DNS` referenced in step 5.

### Step 5 — Register task definitions and create services

**Goal:** define how each container runs and launch one ECS service per task definition. Each service registers itself against its target group, so the ALB starts forwarding traffic as soon as the health check passes.

First create the cluster and ensure the task execution role exists:

```bash
aws ecs create-cluster --cluster-name ipl-checklist

# Create the role only if it does not already exist in the account
aws iam create-role --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

Create CloudWatch log groups so the awslogs driver has somewhere to write:

```bash
aws logs create-log-group --log-group-name /ecs/ipl-checklist-server
aws logs create-log-group --log-group-name /ecs/ipl-checklist-web
aws logs put-retention-policy --log-group-name /ecs/ipl-checklist-server --retention-in-days 7
aws logs put-retention-policy --log-group-name /ecs/ipl-checklist-web    --retention-in-days 7
```

Write `server-taskdef.json` (Fargate, 256 CPU / 512 MB, awsvpc network mode):

```json
{
  "family": "ipl-checklist-server",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::<your-account-id>:role/ecsTaskExecutionRole",
  "containerDefinitions": [{
    "name": "server",
    "image": "<your-account-id>.dkr.ecr.<your-region>.amazonaws.com/ipl-checklist-server:latest",
    "essential": true,
    "portMappings": [{ "containerPort": 4000, "protocol": "tcp" }],
    "environment": [
      { "name": "DATABASE_URL", "value": "postgres://ipladmin:<password>@<rds-endpoint>:5432/ipl" },
      { "name": "PORT",         "value": "4000" },
      { "name": "PGSSL",        "value": "true" },
      { "name": "CORS_ORIGIN",  "value": "http://<alb-dns>" }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group":         "/ecs/ipl-checklist-server",
        "awslogs-region":        "<your-region>",
        "awslogs-stream-prefix": "server"
      }
    }
  }]
}
```

Write `web-taskdef.json` with the same structure but pointing at the web image, `containerPort: 3000`, and a smaller env block:

```json
{
  "family": "ipl-checklist-web",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::<your-account-id>:role/ecsTaskExecutionRole",
  "containerDefinitions": [{
    "name": "web",
    "image": "<your-account-id>.dkr.ecr.<your-region>.amazonaws.com/ipl-checklist-web:latest",
    "essential": true,
    "portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
    "environment": [
      { "name": "API_URL",  "value": "http://<alb-dns>" },
      { "name": "NODE_ENV", "value": "production" }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group":         "/ecs/ipl-checklist-web",
        "awslogs-region":        "<your-region>",
        "awslogs-stream-prefix": "web"
      }
    }
  }]
}
```

Register both task definitions and create both services:

```bash
aws ecs register-task-definition --cli-input-json file://server-taskdef.json
aws ecs register-task-definition --cli-input-json file://web-taskdef.json

# Server service first — the web task expects the API to be reachable
aws ecs create-service --cluster ipl-checklist --service-name ipl-server \
  --task-definition ipl-checklist-server --desired-count 1 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet-az-a>,<subnet-az-b>],securityGroups=[<ecs-sg-id>],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=<server-tg-arn>,containerName=server,containerPort=4000"

aws ecs wait services-stable --cluster ipl-checklist --services ipl-server

aws ecs create-service --cluster ipl-checklist --service-name ipl-web \
  --task-definition ipl-checklist-web --desired-count 1 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet-az-a>,<subnet-az-b>],securityGroups=[<ecs-sg-id>],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=<web-tg-arn>,containerName=web,containerPort=3000"

aws ecs wait services-stable --cluster ipl-checklist --services ipl-web
```

`assignPublicIp=ENABLED` is required because the tasks live in public subnets and need outbound internet access to pull images from ECR. With a private subnet plus NAT gateway you would set this to `DISABLED`, at the cost of an additional NAT gateway hourly charge.

**Verify:** `aws elbv2 describe-target-health --target-group-arn <tg-arn>` shows `State: healthy` for both target groups, and a request to `http://<alb-dns>/` returns the home page.

## Environment Variables

| Variable        | Used by | Purpose                                                                    | Set in compose                | Set in ECS task definition                  |
| --------------- | ------- | -------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------- |
| `DATABASE_URL`  | server  | Postgres connection string                                                 | `postgres://ipl:ipl@db:5432/ipl` | `postgres://ipladmin:<password>@<rds-endpoint>:5432/ipl` |
| `PORT`          | server  | TCP port the Express app binds to                                          | `4000`                        | `4000`                                      |
| `CORS_ORIGIN`   | server  | Allowed origin for browser CORS preflights                                 | `http://localhost:3000`       | `http://<alb-dns>`                          |
| `PGSSL`         | server  | When `true`, opens the Postgres connection over SSL with `rejectUnauthorized: false` | unset (off)                   | `true`                                      |
| `API_URL`       | web     | Where the Next.js runtime proxy forwards `/api/*` to                       | `http://server:4000`          | `http://<alb-dns>`                          |
| `NODE_ENV`      | web     | Toggles Next.js production runtime                                         | `production`                  | `production`                                |

The web service reads `API_URL` on every request (inside the route handler at [web/app/api/[...path]/route.ts](web/app/api/[...path]/route.ts)) so it's a pure runtime variable — the same image works in any environment without rebuilding. The server reads its env vars at startup as is conventional for a long-lived process.

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend:** Express, TypeScript, `pg` (node-postgres)
- **Database:** PostgreSQL 16
- **Containers:** Docker, multi-stage builds, `linux/amd64` images
- **Cloud:** AWS (ECS Fargate, ECR, RDS, ALB, VPC, IAM, CloudWatch Logs)
