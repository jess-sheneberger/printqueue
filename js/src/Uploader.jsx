import "./Uploader.css";
import { FileUploader } from "react-drag-drop-files";
import SingleUpload from "./SingleUpload.jsx"
import { useState } from "react";

export default function Uploader(props) {
  const [files, setFiles] = useState(null);
  const handleChange = (list) => {
    // convert from FileList to array
    let toAdd = [];
    if (list.length > 0) {
      for (let z of list) {
        toAdd.push(z);
      }
    }
    if (files == null) {
      setFiles(toAdd);
    } else {
      setFiles(files.concat(toAdd));
    }
  };

  let progress;
  let inside;
  if (files) {
    progress = [];
    for (let i = 0; i < files.length; i++) {
      progress.push(<SingleUpload token={props.token} email={props.email} file={files[i]} />)
    }

    progress = <div>Progress: {progress}</div>;

    inside = <span>More? <span className="underlined">Upload</span> or drop more files here</span>;
  } else {
    inside = <span><span className="underlined">Upload</span> or drop files right here</span>;
  }

  return (
    <div>
        <FileUploader
          multiple={true}
          handleChange={handleChange}>
          <div className="Uploader">
            {inside}
          </div>
        </FileUploader>
      <div>{progress}</div>
    </div>
  );
}