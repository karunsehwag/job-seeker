const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// jobs.json lives in frontend/ and is served as a plain static file, same as
// index.html/app.js/style.css - the identical file GitHub Pages serves too.
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.listen(PORT, () => {
  console.log(`Job seeker app running at http://localhost:${PORT}`);
});
