import React from "react";

import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from "@mui/material";

const DialogBox = ({
  open,
  title,
  content,
  button1Text,
  button1Action,
  button2Text,
  button2Action,
  handleClose,
}) => {
  return (
    <Dialog open={open} onClose={handleClose} aria-labelledby="dialog-title">
      {title && <DialogTitle id="dialog-title">{title}</DialogTitle>}
      {content && (
        <DialogContent>
          <DialogContentText>{content}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        {button1Text && (
          <Button onClick={button1Action} color="primary">
            {button1Text}
          </Button>
        )}
        {button2Text && (
          <Button onClick={button2Action} color="secondary">
            {button2Text}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DialogBox;