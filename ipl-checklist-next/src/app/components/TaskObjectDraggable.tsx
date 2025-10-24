import React, { useRef } from 'react';
import Task from '../types/task';
import Draggable from 'react-draggable';

export default function DraggableTest() {
  const T: Task = {
    name: "Tasky McTaskface",
    subTasks: ["Hello","World!"],
    teams: ["Mork","Gork"],
    prereq: [],
    expectedTime: 10,
    actualTime: 0,
    completed: false
  }
  const nodeRef = useRef<any>(null);

  return (
    <Draggable nodeRef={nodeRef}
    >
      <div className="m-2 p-2 bg-red-200 font-bold rounded-lg"
        ref={nodeRef}
        style={{ position: "relative", zIndex: 1000 }}
        id="TaskBody"
      >
        <h1>{T.name}</h1>
        <p>{T.subTasks}</p>
        <p>{T.teams}</p>
      </div>
    </Draggable>
  );
};
