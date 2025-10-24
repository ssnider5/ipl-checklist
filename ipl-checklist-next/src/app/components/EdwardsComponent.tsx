import React from 'react';
import MyType from '../types/basics';

export default function EdwardsComponent({coderName="John React", componentData=["Hello","World!"]}: MyType) {
  return(
    <div>
      <h1>
        {componentData.map((element,index) => (
          <li key={index}>
            {element}
          </li>))}
      </h1>
      <h1>
        Page created by {coderName}
      </h1>
    </div>
  )
}