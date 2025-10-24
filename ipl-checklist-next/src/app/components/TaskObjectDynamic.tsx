import React, { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

import Task from '../types/task';



export default function TaskComponentDynamic(props: any) {
    /* const T: Task = {
         name: "Tasky McTaskface",
         subTasks: ["Hello", "World!"],
         teams: ["Mork", "Gork"],
         prereq: [],
         expectedTime: 10,
         actualTime: 0,
         completed: false
     } */


    const [data, setData] = useState<Task | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fetchData = async () => {
        try {
            const response = await fetch('http://localhost:3002/api/testTask');
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const T: Task = await response.json();
            setData(T);
            setError(null);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Error fetching data');
            setData(null);
        }
    };


    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: props.id
    });

    // Within your component that receives `transform` from `useDraggable`:
    const style = {
        transform: CSS.Translate.toString(transform),
    }

    useEffect(() => {
        /* fetchData() */
    })
    return (
        <div className="m-2 p-2 bg-fiserv text-black font-bold rounded-lg"
            ref={setNodeRef} style={style} {...listeners} {...attributes}
        >
            <h1>{data && data.name}</h1>
            <p>{data && data.subTasks}</p>
            <p>{data && data.teams}</p>
            <p>{data && data.prereq}</p>
            <p>{data && data.completed}</p>
            <p>{data && data.actualTime}</p>
            <p>{error && error}</p>
            <p>THIS IS DRAGGABLE TASK ID= {props.id}</p>
            {props.children}
        </div>
    )
}