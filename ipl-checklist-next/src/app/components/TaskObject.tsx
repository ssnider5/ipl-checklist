import React from 'react';
import Task from '../types/task';

export default function TaskComponent() {
  const T: Task = {
    name: "Tasky McTaskface",
    subTasks: ["Hello","World!"],
    teams: ["Mork","Gork"],
    prereq: [],
    expectedTime: 10,
    actualTime: 0,
    completed: false
  }

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('text', event.currentTarget.id);
  }
  

  return(
    <div className="m-2 p-2 bg-red-200 font-bold rounded-lg"
      draggable="true"
      onDragStart={handleDragStart}
    >
      <h1>{T.name}</h1>
      <p>{T.subTasks}</p>
      <p>{T.teams}</p>
    </div>
  )
}
