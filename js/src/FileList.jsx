import React from 'react';
import { DateTime } from "luxon";
import Table from 'react-bootstrap/Table';
import {get} from "./request";

let errForbidden = new Error("forbidden");

export default class FileList extends React.Component {
  async getFiles() {
    if (!this.props.token) {
      throw errForbidden;
    }
    let result = await get("/api/files?access_token=" + this.props.token);
    if (result.ok) {
      return await result.json();
    } else {
      if (result.status === 403) {
        throw errForbidden;
      }
      throw new Error(`Listing files returned ${result.statusText}`);
    }
  }

  componentDidMount() {
    this.getFiles().then(async result => {
      this.setState({ files: result.files });
    }).catch(err => {
      this.setState({ status: { error: err } });
    });
  }

  render() {
    if (!this.state) {
      return <div>Loading...</div>
    }

    if (this.state.status && this.state.status.error) {
      if (this.state.status.error === errForbidden) {
        return (<div>Sorry, this page isn't available without an access token.</div>);
      }
      return (<div>Error loading files: {this.state.status.error.message} </div>);
    }

    let files = [];
    for (let file of this.state.files) {
      let dt = DateTime.fromISO(file.created);

      files.push(<tr>
        <td><a class="App-link" href={file.downloadLink}>{file.name}</a></td>
        <td><span title={dt.toRFC2822()}>{dt.toRelative()}</span></td>
        <td>{file.uploader}</td>
      </tr>);
    }

    return (
      <Table bordered hover>
        <thead>
          <tr>
            <th colSpan="3">found {files.length} files </th>
          </tr>
          <tr>
            <th>File Name</th>
            <th>Uploaded</th>
            <th>Uploaded by</th>
          </tr>
        </thead>
        <tbody>
          {files}
        </tbody>
      </Table>
    );
  }
}
