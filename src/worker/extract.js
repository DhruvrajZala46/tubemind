const express = require('express');
const app = express();
app.use(express.json());

app.post('/start', async (req, res) => {
  try {
    await startWorker();
    res.status(200).send('Job started!');
  } catch (err) {
    console.error('Error in /start:', err);
    res.status(500).send('Error starting job');
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('Worker listening on port', PORT);
}); 