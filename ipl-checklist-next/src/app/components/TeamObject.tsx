import React from 'react';
import Team from '../types/team';

export default function TeamComponent() {
  const T: Team = {
    name: "I'm a team!",
    members: ["Bill", "Bob", "Bort"]
  }
  return(
    <div className="m-2 p-2 bg-red-200 font-bold rounded-lg">
      <h1>{T.name}</h1>
    </div>
  )
}