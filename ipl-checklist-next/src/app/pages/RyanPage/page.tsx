'use client';

import "./styles.css"
import React, { useState } from "react"
import TaskComponent from "../../components/TaskObject";
import TeamComponent from "../../components/TeamObject";
import RemoveTaskButton from "@/app/components/RemoveTaskButton";
import TaskComponentDynamic from "@/app/components/TaskObjectDynamic";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import DropZone from "@/app/components/WhereWeDroppingBoys";
import XIcon from "@/app/components/Icons/XIcon";

export default function Home() {

  const containers = [1, 2, 3, 4, 5, 6]

  const initialTasks = ["Draggable1", "Draggable2", "Draggable3"];

  // Map each container to the task placed in it (or null) 
  const [assignments, setAssignments] = useState<Record<number, string[]>>(() => Object.fromEntries(containers.map(id => [id, []])) as Record<number, string[]>);
  
  // Tasks still available in the right pane
  const [availableTasks, setAvailableTasks] = useState<string[]>(initialTasks);

  // Track the active drag (optional; helpful for debugging)
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1
      }
    })
  )

  // Drops a task into a container (supports multiple per container)
  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over) return;
    const containerId = Number(over.id); const taskId = String(active.id);
    setAssignments((prev) => {
      // Find the previous container (if any) that held this task
      let prevContainerId: number | null = null;
      for (const key of Object.keys(prev)) {
        const cid = Number(key);
        if (prev[cid].includes(taskId)) { prevContainerId = cid; break; }
      }
      const next: Record<number, string[]> = { ...prev };

      // If task was already in a container, remove it from there
      if (prevContainerId !== null) {
        next[prevContainerId] = next[prevContainerId].filter((t) => t !== taskId);
      } else {
        // Task came from the available list; remove it from there
        setAvailableTasks((avail) => avail.filter((t) => t !== taskId));
      }

      // Add to the target container (avoid duplicates)
      const existing = next[containerId] ?? [];
      next[containerId] = existing.includes(taskId) ? existing : [...existing, taskId];

      return next;
    })
  }
  // Removes a specific task from a container and returns it to the available list 
  function removeTask(containerId: number, taskId: string) {
    setAssignments((prev) => {
      const next = { ...prev };
      next[containerId] = (next[containerId] ?? []).filter((t) => t !== taskId);
      return next;
    });

    setAvailableTasks((avail) => (avail.includes(taskId) ? avail : [...avail, taskId]));
  }



  function handleDragStart(event: any) {
    const { active } = event;
    setActiveId(active.id);
    console.log(" * Now dragging", active.id);
  }

  const draggableMarkup = (
    <TaskComponentDynamic id="draggable">
    </TaskComponentDynamic>
  );




  return (
    <div id="main" style={{ position: "relative", zIndex: 1 }}>
      <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} sensors={sensors}>
        <div id="leftPane">
          <div className="m-2 p-2 bg-blue-200 font-bold rounded-lg" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p>IPL / DR plan</p>
            <div>
              <button className="bg-red-200" style={{ borderRadius: '10px', padding: '0px 4px' }}>Save Plan</button>
              <button className="bg-red-200" style={{ borderRadius: '10px', padding: '0px 4px', marginLeft: '10px' }}>Second Action</button>
              <button className="bg-red-200" style={{ borderRadius: '10px', padding: '0px 4px', marginLeft: '10px' }}>Third Action</button>
            </div>
          </div>
          <div className="overflow-hidden display:flex flex-direction:column overflow-y:auto bg-slate-800  max-height:94vh">
            {containers.map((containerId) => (
              <DropZone key={containerId} id={containerId}>
                {assignments[containerId] && assignments[containerId].length > 0 ? (
                  assignments[containerId].map((taskId) => (
                    <TaskComponentDynamic key={`${containerId}-${taskId}`} id={taskId}>
                      <RemoveTaskButton
                        handleClick={() => removeTask(containerId, taskId)}>
                      </RemoveTaskButton>
                    </TaskComponentDynamic>
                  ))
                ) : ('Drop here!')}
              </DropZone>
            ))}
          </div>
        </div>

        <div id="rightPane">
          <div id="TopRightPane">
            <div className="m-2 p-2 bg-green-200 font-bold rounded-lg" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <p>Tasks</p>
              <div>
                <button className="bg-red-200" style={{ borderRadius: '10px', padding: '0px 4px' }}>Save Plan</button>
                <button className="bg-red-200" style={{ borderRadius: '10px', padding: '0px 4px', marginLeft: '10px' }}>Second Action</button>
                <button className="bg-red-200" style={{ borderRadius: '10px', padding: '0px 4px', marginLeft: '10px' }}>Third Action</button>
              </div>
            </div>

            <div id="TopRightScroll">
              {availableTasks.map((id) => (
                <TaskComponentDynamic key={id} id={id} />
              ))}
            </div>
          </div>

          <div id="BottomRightPane">
            <div className="m-2 p-2 bg-yellow-200 font-bold rounded-lg" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <p>Teams</p>
              <div>
                <button className="bg-red-200" style={{ borderRadius: '10px', padding: '0px 4px' }}>Save Plan</button>
                <button className="bg-red-200" style={{ borderRadius: '10px', padding: '0px 4px', marginLeft: '10px' }}>Second Action</button>
                <button className="bg-red-200" style={{ borderRadius: '10px', padding: '0px 4px', marginLeft: '10px' }}>Third Action</button>
              </div>
            </div>
            <div id="BottomRightScroll">
              <TeamComponent />
            </div>
          </div>
        </div>
      </DndContext>
    </div>

  )
  /*
    return (
      <div id="main"
              style={{ position: "relative", zIndex: 1 }}>
              <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} sensors={sensors}>
                <div id="leftPane">
                  <div className="m-2 p-2 bg-blue-200 font-bold rounded-lg"
                    style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <p>IPL / DR plan</p>
                    <div>
                      <button className="bg-red-200" style={{ justifySelf: 'end', alignSelf: 'self-end', borderRadius: '10px', padding: '0px 4px' }}>Save Plan</button>
                      <button className="bg-red-200" style={{ justifySelf: 'end', alignSelf: 'self-end', borderRadius: '10px', padding: '0px 4px', marginLeft: '10px' }}>Second Action</button>
                      <button className="bg-red-200" style={{ justifySelf: 'end', alignSelf: 'self-end', borderRadius: '10px', padding: '0px 4px', marginLeft: '10px' }}>Third Action</button>
                    </div>
                  </div>
                  <div className="overflow-hidden" id="planScroll">
                    {containers.map((id) => (
                      <DropZone key={id} id={id}>
                        {parent === id ? <TaskComponentDynamic id="draggable">
                          <button type="button" onClick={removeTask} className="text-white bg-blue-200 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm p-2.5 text-center inline-flex items-center me-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                            <XIcon />
                          </button>
                        </TaskComponentDynamic> : 'Drop here!'}
                      </DropZone>
                    ))}
                  </div>
                </div>
                <div id="rightPane">
                  <div id="TopRightPane">
                    <div className="m-2 p-2 bg-green-200 font-bold rounded-lg"
                      style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <p>Tasks</p>
                      <div>
                        <button className="bg-red-200" style={{ justifySelf: 'end', alignSelf: 'self-end', borderRadius: '10px', padding: '0px 4px' }}>Save Plan</button>
                        <button className="bg-red-200" style={{ justifySelf: 'end', alignSelf: 'self-end', borderRadius: '10px', padding: '0px 4px', marginLeft: '10px' }}>Second Action</button>
                        <button className="bg-red-200" style={{ justifySelf: 'end', alignSelf: 'self-end', borderRadius: '10px', padding: '0px 4px', marginLeft: '10px' }}>Third Action</button>
                      </div>
                    </div>
                    <div id="TopRightScroll">
                      {tasks.map((id) => (
                        <TaskComponentDynamic key={id} id={id}>
                        </TaskComponentDynamic>
                      ))}
                      {parent === null ? draggableMarkup : null}
                    </div>
                  </div>
                  <div id="BottomRightPane">
                    <div className="m-2 p-2 bg-yellow-200 font-bold rounded-lg"
                      style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <p>Teams</p>
                      <div>
                        <button className="bg-red-200" style={{ justifySelf: 'end', alignSelf: 'self-end', borderRadius: '10px', padding: '0px 4px' }}>Save Plan</button>
                        <button className="bg-red-200" style={{ justifySelf: 'end', alignSelf: 'self-end', borderRadius: '10px', padding: '0px 4px', marginLeft: '10px' }}>Second Action</button>
                        <button className="bg-red-200" style={{ justifySelf: 'end', alignSelf: 'self-end', borderRadius: '10px', padding: '0px 4px', marginLeft: '10px' }}>Third Action</button>
                      </div>
                    </div>
                    <div id="BottomRightScroll">
                      <TeamComponent />
                    </div>
                  </div>
                </div>
              </DndContext>
            </div>
            );
            */
}
