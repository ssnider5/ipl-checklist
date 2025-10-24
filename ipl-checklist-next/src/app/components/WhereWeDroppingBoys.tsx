import React from 'react';
import {useDroppable} from '@dnd-kit/core';


export default function DropZone(props:any){

  const {isOver, setNodeRef} = useDroppable({
    id: props.id
  });
  const style = {
    color: isOver ? 'green' : undefined,
  };
  
  
  return (
    <div  className="m-2 p-2 min-h-50 bg-white font-bold rounded-lg text-black" ref={setNodeRef} style={style}>
        Step {props.id}
        <br/>
        {props.children}
    </div>
  );
}

