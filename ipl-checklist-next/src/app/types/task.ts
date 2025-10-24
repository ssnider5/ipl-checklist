type Task = {
    name: string;
    subTasks: string[];
    teams: string[];
    prereq: string[];
    expectedTime: number;
    actualTime: number;
    completed: boolean;
}



export default Task