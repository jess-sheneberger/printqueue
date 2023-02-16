import "./App.css";
import React from 'react';
import Container from 'react-bootstrap/Container';
import Spinner from 'react-bootstrap/Spinner';
import { instanceOf } from 'prop-types';
import { withCookies, Cookies } from 'react-cookie';

import {get} from "./request";

import logo from "./logo.svg";
import Uploader from "./Uploader";
import FileList from "./FileList";
import LoginModal from "./LoginModal";

async function verifyAccessToken(token) {
  let result = await get(`/api/me?access_token=${token}`);

  if (!result.ok) {
    throw new Error(`Could not verify access token: ${result.statusText}`, { cause: { status: result.status, statusText: result.statusText } });
  }

  let verifyResult = await result.json();

  return verifyResult.type;
}

class App extends React.Component {
  static propTypes = {
    cookies: instanceOf(Cookies).isRequired
  };

  constructor(props) {
    super(props);
    const { cookies } = props;
    this.state = {
      route: { default: true },
      email: cookies.get('email'),
    };

  }

  componentDidMount() {
    // this is a stupid router
    // if it gets too much more complicated, replace it with something better
    let state = { showLogin: true };
    let params = new URLSearchParams(window.location.search);
    let token = params.get("access_token");
    if (token !== "") {
      state.token = token;
    }

    this.setState(state);

    verifyAccessToken(token).then((type) => {
      if (window.location.pathname === "/lab") {
        if (type === "down") {
          state.route = "lab";
        } else {
          state.route = "unauthorized";
        }
      } else {
        if (type === "up") {
          state.route = "upload";
        } else {
          state.route = "unauthorized";
        }
      }
      if (!state.token) {
        state.route = "unauthorized";
      }

      this.setState(state);
    }).catch(err => {
      state.route = "unauthorized";
      state.error = err;
      this.setState(state);
    })

  }


  handleEmailChange(event) {
    this.setState({ email: event.currentTarget.value });
  }

  handleLoginDone() {
    const { cookies } = this.props;

    cookies.set('email', this.state.email, { path: '/' });
    this.setState({ showLogin: false });
  }

  render() {

    if (this.state.route === "unauthorized") {
      let message = "Sorry, an error occurred: Unauthorized";
      if (this.state.error) {
        message = `Could not load the page: ${this.state.error}`;
      }

      return (
        <Container className="p-3">
          <h2>GJ Makerspace 3D Print Queue</h2>
          <div>{message}</div>
        </Container>
      );
    }

    if (this.state.route === "lab") {
      return (
        <Container className="p-3">
          <h2>GJ Makerspace 3D Print Queue</h2>
          <FileList token={this.state.token} />
        </Container>
      )
    }

    if (this.state.route === "upload") {
      return (
        <Container className="p-3">
          <LoginModal show={this.state.showLogin} email={this.state.email} onEmailChange={this.handleEmailChange.bind(this)} onLoginDone={this.handleLoginDone.bind(this)} />
          <h2>GJ Makerspace 3D Print Queue</h2>
          <div>This is the print queue, where you may upload your STL files to access from the 3d print lab.</div>
          <div>Give your files descriptive names. This will be the only way to identify them once you get to the lab.</div>
          <div>Files uploaded here will be automatically deleted after 7 days. Files must be under 50MB.</div>
          <div>Files uploaded here will not be printed by anyone unless you print them! This is intended as a convenience so you don't need to bring a USB memory stick or SD card to the Makerspace.</div>
          <div>This directory is open to visitors, members, volunteers, and management of the Makerspace (and possibly others!) If you don't want to widely share your files, use a USB memory stick.</div>
          <Uploader token={this.state.token} email={this.state.email} />
          <img src={logo} className="App-logo" alt="logo" />
        </Container>
      );
    }

    return (
      <Container className="p-3">
        <h2>GJ Makerspace 3D Print Queue</h2>
        <div><Spinner animation="border" />Loading...</div>
      </Container>
    )

  }
}

export default withCookies(App);