import XIcon from "./Icons/XIcon"

export default function RemoveTaskButton(props: any) {


    return (
        <button
        onClick={props.handleClick}
         className="text-white
                           bg-blue-700
                           hover:bg-blue-700
                           focus:ring-4
                           focus:outline-none
                           focus:ring-blue-800 
                           font-medium
                           rounded-lg
                           text-sm p-2.5
                           text-center 
                           inline-flex 
                           items-center
                           me-2
                           dark:bg-blue-600 
                           dark:hover:bg-blue-700
                           dark:focus:ring-blue-800">
            <XIcon />
        </button>
    )
}