
const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const dbPath = process.env.DB_PATH || path.join(__dirname, "bookings.db");
const db = new Database(dbPath);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Create database table
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_code TEXT UNIQUE,
    movie TEXT NOT NULL,
    show_date TEXT NOT NULL,
    show_time TEXT NOT NULL,
    seats TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    payment TEXT NOT NULL,
    total INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

const movies = [
  {
    id: 1,
    title: "Interstellar",
    genre: "Sci-Fi",
    duration: "2h 49m",
    price: 150,
    poster: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"
  },
  {
    id: 2,
    title: "Inception",
    genre: "Action",
    duration: "2h 28m",
    price: 150,
    poster: "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg"
  },
  {
    id: 3,
    title: "The Dark Knight",
    genre: "Action",
    duration: "2h 32m",
    price: 180,
    poster: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg"
  },
  {
    id: 4,
    title: "Dune: Part Two",
    genre: "Adventure",
    duration: "2h 46m",
    price: 180,
    poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg"
  }
];

// Get movies
app.get("/api/movies", (req, res) => {
  res.json(movies);
});

// Get booked seats for a show
app.get("/api/seats", (req, res) => {
  const { movie, date, time } = req.query;

  if (!movie || !date || !time) {
    return res.status(400).json({ error: "Missing show details" });
  }

  const rows = db.prepare(`
    SELECT seats FROM bookings
    WHERE movie = ? AND show_date = ? AND show_time = ?
  `).all(movie, date, time);

  const bookedSeats = rows.flatMap(row => JSON.parse(row.seats));
  res.json(bookedSeats);
});

// Create booking
app.post("/api/bookings", (req, res) => {
  const {
    movie, date, time, seats,
    name, phone, payment, total
  } = req.body;

  if (
    !movie || !date || !time ||
    !Array.isArray(seats) || seats.length === 0 ||
    !name || !/^[0-9]{10}$/.test(phone) ||
    !["UPI", "Cash"].includes(payment)
  ) {
    return res.status(400).json({ error: "Please enter valid booking details" });
  }

  if (new Date(date + "T00:00:00") < new Date(new Date().toDateString())) {
    return res.status(400).json({ error: "Please select a future date" });
  }

  const selectedMovie = movies.find(m => m.title === movie);

  if (!selectedMovie) {
    return res.status(400).json({ error: "Movie not found" });
  }

  if (seats.length > 8 || new Set(seats).size !== seats.length ||
      seats.some(seat => !/^[A-D][1-8]$/.test(seat))) {
    return res.status(400).json({ error: "Invalid seat selection" });
  }

  const correctTotal = selectedMovie.price * seats.length;

  if (Number(total) !== correctTotal) {
    return res.status(400).json({ error: "Invalid ticket total" });
  }

  const createBooking = db.transaction(() => {
    const existing = db.prepare(`
      SELECT seats FROM bookings
      WHERE movie = ? AND show_date = ? AND show_time = ?
    `).all(movie, date, time);

    const alreadyBooked = existing.flatMap(row => JSON.parse(row.seats));

    if (seats.some(seat => alreadyBooked.includes(seat))) {
      throw new Error("One or more seats have already been booked. Please choose again.");
    }

    const code = "CB" + Date.now().toString().slice(-8);

    db.prepare(`
      INSERT INTO bookings
      (booking_code, movie, show_date, show_time, seats,
       customer_name, phone, payment, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code, movie, date, time, JSON.stringify(seats),
      name.trim(), phone, payment, correctTotal
    );

    return {
      booking_code: code,
      movie,
      date,
      time,
      seats,
      name: name.trim(),
      phone,
      payment,
      total: correctTotal,
      status: "Confirmed"
    };
  });

  try {
    const booking = createBooking();
    res.status(201).json(booking);
  } catch (error) {
    res.status(409).json({ error: error.message });
  }
});

// My bookings
app.get("/api/bookings", (req, res) => {
  const phone = req.query.phone;

  if (!phone || !/^[0-9]{10}$/.test(phone)) {
    return res.status(400).json({ error: "Enter a valid phone number" });
  }

  const bookings = db.prepare(`
    SELECT * FROM bookings
    WHERE phone = ?
    ORDER BY id DESC
  `).all(phone);

  res.json(bookings.map(b => ({
    ...b,
    seats: JSON.parse(b.seats),
    status: "Confirmed"
  })));
});

app.listen(PORT, () => {
  console.log(`CineBook running at http://localhost:${PORT}`);
});
