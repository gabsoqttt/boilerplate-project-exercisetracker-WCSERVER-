const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static('public'));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User and exercise schema
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  log: [{
    description: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      required: true
    }
  }]
});

const User = mongoose.model('User', userSchema);

// Home page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// 1. Create a new user
app.post('/api/users', async (req, res) => {
  try {
    const username = req.body.username;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = await User.create({
      username: username.trim()
    });

    res.json({
      username: user.username,
      _id: user._id.toString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create user' });
  }
});

// 2. Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username');

    res.json(users.map(user => ({
      username: user.username,
      _id: user._id.toString()
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not retrieve users' });
  }
});

// 3. Add an exercise to a user
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const user = await User.findById(req.params._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const description = req.body.description;
    const duration = Number(req.body.duration);
    const date = req.body.date
      ? new Date(req.body.date)
      : new Date();

    if (
      typeof description !== 'string' ||
      !description.trim() ||
      req.body.duration === undefined ||
      req.body.duration === '' ||
      !Number.isFinite(duration) ||
      !Number.isFinite(date.getTime())
    ) {
      return res.status(400).json({ error: 'Invalid exercise data' });
    }

    user.log.push({
      description: description.trim(),
      duration: duration,
      date: date
    });

    await user.save();

    res.json({
      username: user.username,
      description: description.trim(),
      duration: duration,
      date: date.toDateString(),
      _id: user._id.toString()
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Could not add exercise' });
  }
});

// 4. Get a user's exercise log
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const user = await User.findById(req.params._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let log = user.log.map(exercise => ({
      description: exercise.description,
      duration: exercise.duration,
      date: exercise.date.toDateString()
    }));

    // Filter by starting date
    if (req.query.from) {
      const fromDate = new Date(req.query.from);

      if (!Number.isNaN(fromDate.getTime())) {
        log = log.filter(exercise =>
          new Date(exercise.date) >= fromDate
        );
      }
    }

    // Filter by ending date
    if (req.query.to) {
      const toDate = new Date(req.query.to);
      toDate.setHours(23, 59, 59, 999);

      if (!Number.isNaN(toDate.getTime())) {
        log = log.filter(exercise =>
          new Date(exercise.date) <= toDate
        );
      }
    }

    // Filter by number of logs
    if (req.query.limit !== undefined) {
      const limit = parseInt(req.query.limit, 10);

      if (Number.isInteger(limit) && limit >= 0) {
        log = log.slice(0, limit);
      }
    }

    res.json({
      username: user.username,
      count: user.log.length,
      _id: user._id.toString(),
      log: log
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Could not retrieve exercise log' });
  }
});

// Start the server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log(
    'Your app is listening on port ' + listener.address().port
  );
});