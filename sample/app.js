document.addEventListener("DOMContentLoaded", () => {
  decodeButton.addEventListener("change", () => {
    if (decodeButton.files.length === 0) {
      return;
    }
    clearMessage();
    lockButtons();
    stackMessage("Decoding...");
    APNGExporter.get(decodeButton.files[0])
        .then(result => {
            stackMessage(`Decoded: width=${result.width} px, height=${result.height} px, loop count=${result.loopCount}, duration=${result.duration}`)
        }, err => {
            stackMessage(`Decode failed: ${err.message}`);
            console.error(err);
        })
        .then(unlockButtons, unlockButtons);
  });
})

function clearMessage() {
  message.textContent = "";
}

function splitFileName(filename) {
  const splitted = filename.split('.');
  const extension = splitted.pop();
  const displayName = splitted.join('.');
  return { displayName, extension }
}

function stackMessage(text) {
  const p = document.createElement("p");
  p.textContent = text;
  message.appendChild(p);
}

function lockButtons() {
    decodeButton.disabled = true;
}

function unlockButtons() {
    decodeButton.disabled = false;
}