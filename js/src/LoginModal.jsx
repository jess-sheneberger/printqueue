import React from "react";
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';



export default class LoginModal extends React.Component {  
  componentDidMount() {
  }

  render() {
    return (
      <Modal show={this.props.show}
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header>
          <Modal.Title>Login</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form>
            <Form.Group className="mb-3" controlId="exampleForm.ControlInput1">
              <Form.Label>Email address</Form.Label>
              <Form.Control type="email" placeholder="name@example.com" value={this.props.email} onChange={this.props.onEmailChange} />
            </Form.Group>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="primary" onClick={this.props.onLoginDone}>Login</Button>
        </Modal.Footer>
      </Modal>
    );

  }
}