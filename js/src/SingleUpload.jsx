import React from 'react';
import Spinner from 'react-bootstrap/Spinner';
import {get, post, put} from "./request";

async function upload(file, email, token) {
  if (file.size > 50*1024*1024) {
    // short-circuit; x-goog-content-length-range works on server-side but is slower than this
    return {tooBig: true};
  }
  
  let obj = await getUpload(file.name, email, token);

  let uploadResult = await put(obj.url, {
    headers: obj.headers,
    file: file
  });

  if (!uploadResult.ok) {
    let apiError = await uploadResult.text();
    throw new Error(`Error uploading '${this.state.file.name}: ${apiError}`);
  }

  let finishResult = await finish(obj.id, email, token);
  if (!finishResult.ok) {
    let apiError = await uploadResult.text();
    throw new Error(`Error finishing upload '${this.state.file.name}: ${apiError}`);
  }

  return {};
}

async function finish(id, email, token) {
  return await post(`/api/finish?access_token=${token}`, {
    data:{id, email}
  });
}

async function getUpload(filename, email, token) {
  let uploadResult = await post(`/api/upload?access_token=${token}`, {
    data: {filename, email}
  });
  return await uploadResult.json();
}

export default class SingleUpload extends React.Component {
  constructor(props) {
    super(props);
    this.state = { status: {} };
  }

  componentDidMount() {
    upload(this.props.file, this.props.email, this.props.token).then(async result => {
      if (result.tooBig) {
        this.setState({ status: { success: false, tooBig: true } });
      } else {
        this.setState({ status: { success: true } });
      }
    }).catch(err => {
      this.setState({ status: { error: err } });
    });
  }

  render() {
    if (this.state.status.success) {
      return (
        <div>✅ Upload {this.props.file.name} succeeded</div>
      );
    } else if (this.state.status.tooBig) {
      return (
        <div>❌ Upload {this.props.file.name} failed: file exceeded 50MB limit</div>
      );
    } else if (this.state.status.error) {
      return (
        <div>❌ Upload {this.props.file.name} failed</div>
      );
    } else {
      return (
        <div> 
          <Spinner animation="border" variant="primary" size="sm" />
          Uploading {this.props.file.name}
        </div>
      );
    }
  }


}
