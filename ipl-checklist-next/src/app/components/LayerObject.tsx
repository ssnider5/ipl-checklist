import React from 'react';
import TaskComponent from "./TaskObject";

export default function LayerComponent() {

  const enableDropping = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const id = event.dataTransfer.getData('text');
    console.log(`Somebody dropped an element with id: ${id}`);
  }

  return(
    <div className="m-2 p-2 min-h-50 bg-yellow-200 font-bold rounded-lg" id="row" onDragOver={enableDropping} onDrop={handleDrop}>
      Step One
    </div>
  )
}