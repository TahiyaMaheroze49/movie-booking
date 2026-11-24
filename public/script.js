
let currentUser = null;

function loginUser() {
  const name = $("loginName").value.trim();
  const phone = $("loginPhone").value.trim();

  if (!name || !/^[0-9]{10}$/.test(phone)) {
    $("loginError").innerText =
      "Please enter your name and valid 10-digit phone number.";
    return;
  }

  currentUser = { name, phone };

  localStorage.setItem("cinebookUser", JSON.stringify(currentUser));

  $("name").value = name;
  $("phone").value = phone;

  $("loginError").innerText = "";

  showPage("home");
}

let movies = [];
let selectedMovie = null;
let selectedTime = "";
let selectedSeats = [];
let bookedSeats = [];

const $ = id => document.getElementById(id);

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}


function showPage(page) {
  ["login", "home", "booking", "confirmation", "myBookings"]
    .forEach(id => $(id).classList.add("hidden"));

  $(page).classList.remove("hidden");
  window.scrollTo(0, 0);
}


function showHome() {
  showPage("home");
}

function showBookings() {
  $("searchPhone").value = $("phone").value || "";
  $("bookingResults").innerHTML = "";
  showPage("myBookings");
}

async function loadMovies() {
  try {
    const response = await fetch("/api/movies");
    if (!response.ok) throw new Error("Could not load movies");

    movies = await response.json();

    $("movieList").innerHTML = movies.map(movie => `
      <div class="movie-card">
        <img src="${escapeHTML(movie.poster)}"
             alt="${escapeHTML(movie.title)}"
             onerror="this.src='https://placehold.co/400x600/d71920/ffffff?text=Movie'">
        <div class="movie-info">
          <h3>${escapeHTML(movie.title)}</h3>
          <p>${escapeHTML(movie.genre)} | ${escapeHTML(movie.duration)}</p>
          <p>Ticket: ₹${movie.price}</p>
          <button onclick="selectMovie(${movie.id})">
            Book Now
          </button>
        </div>
      </div>
    `).join("");
  } catch (error) {
    $("movieList").innerHTML = "<p>Unable to load movies. Please refresh.</p>";
  }
}

function selectMovie(id) {
  selectedMovie = movies.find(movie => movie.id === id);
  selectedTime = "";
  selectedSeats = [];
  bookedSeats = [];

  $("selectedMovie").innerText =
    selectedMovie.title + " | Ticket Price: ₹" + selectedMovie.price;

  document.querySelectorAll(".times button").forEach(btn => {
    btn.classList.remove("active");
  });

  $("seatList").innerHTML = "";
  $("seatCount").innerText = "None";
  $("total").innerText = "₹0";

  showPage("booking");
  loadSeats();
}

function selectTime(time, button) {
  selectedTime = time;
  selectedSeats = [];

  document.querySelectorAll(".times button").forEach(btn => {
    btn.classList.remove("active");
  });

  button.classList.add("active");
  updateTotal();
  loadSeats();
}

async function loadSeats() {
  const date = $("date").value;

  if (!selectedMovie || !selectedTime || !date) {
    $("seatList").innerHTML = "<p>Select date and show time first.</p>";
    return;
  }

  $("seatList").innerHTML = "<p>Loading seats...</p>";

  try {
    const params = new URLSearchParams({
      movie: selectedMovie.title,
      date,
      time: selectedTime
    });

    const response = await fetch("/api/seats?" + params);

    if (!response.ok) throw new Error("Seat loading failed");

    bookedSeats = await response.json();
    renderSeats();
  } catch (error) {
    $("seatList").innerHTML = "<p>Unable to load seats. Try again.</p>";
  }
}

function renderSeats() {
  const allSeats = [];

  for (const row of ["A", "B", "C", "D"]) {
    for (let i = 1; i <= 8; i++) {
      allSeats.push(row + i);
    }
  }

  $("seatList").innerHTML = allSeats.map(seat => {
    const isBooked = bookedSeats.includes(seat);
    const isSelected = selectedSeats.includes(seat);

    return `
      <button
        class="seat ${isBooked ? "booked" : ""} ${isSelected ? "selected" : ""}"
        ${isBooked ? "disabled" : ""}
        onclick="toggleSeat('${seat}')">
        ${seat}
      </button>
    `;
  }).join("");
}

function toggleSeat(seat) {
  if (selectedSeats.includes(seat)) {
    selectedSeats = selectedSeats.filter(s => s !== seat);
  } else {
    if (selectedSeats.length >= 8) {
      alert("You can select a maximum of 8 seats.");
      return;
    }
    selectedSeats.push(seat);
  }

  renderSeats();
  updateTotal();
}

function updateTotal() {
  $("seatCount").innerText = selectedSeats.length
    ? selectedSeats.join(", ")
    : "None";

  $("total").innerText = "₹" +
    (selectedSeats.length * (selectedMovie?.price || 0));
}

async function bookTicket() {
  const name = $("name").value.trim();
  const phone = $("phone").value.trim();
  const date = $("date").value;
  const payment = $("payment").value;

  if (!selectedMovie || !date || !selectedTime) {
    alert("Please select a movie, date and show time.");
    return;
  }

  if (selectedSeats.length === 0) {
    alert("Please select at least one seat.");
    return;
  }

  if (!name || !/^[0-9]{10}$/.test(phone)) {
    alert("Enter your name and a valid 10-digit phone number.");
    return;
  }

  const total = selectedSeats.length * selectedMovie.price;

  const bookingData = {
    movie: selectedMovie.title,
    date,
    time: selectedTime,
    seats: selectedSeats,
    name,
    phone,
    payment,
    total
  };

  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingData)
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.error || "Booking failed. Please try again.");
      await loadSeats();
      return;
    }

    showConfirmation(result);

  } catch (error) {
    alert("Server error. Please try again.");
  }
}

function showConfirmation(booking) {
  $("ticketDetails").innerHTML = `
    <div class="ticket-details">
      <p><b>Booking ID:</b> ${escapeHTML(booking.booking_code)}</p>
      <p><b>Movie:</b> ${escapeHTML(booking.movie)}</p>
      <p><b>Date:</b> ${escapeHTML(booking.date)}</p>
      <p><b>Time:</b> ${escapeHTML(booking.time)}</p>
      <p><b>Seats:</b> ${escapeHTML(booking.seats.join(", "))}</p>
      <p><b>Name:</b> ${escapeHTML(booking.name)}</p>
      <p><b>Phone:</b> ${escapeHTML(booking.phone)}</p>
      <p><b>Payment:</b> ${escapeHTML(booking.payment)}</p>
      <p><b>Total:</b> ₹${booking.total}</p>
      <p><b>Status:</b> Confirmed</p>
    </div>
  `;

  showPage("confirmation");
}

async function loadBookings() {
  const phone = $("searchPhone").value.trim();

  if (!/^[0-9]{10}$/.test(phone)) {
    alert("Please enter a valid 10-digit phone number.");
    return;
  }

  $("bookingResults").innerHTML = "<p>Loading bookings...</p>";

  try {
    const response = await fetch(
      "/api/bookings?phone=" + encodeURIComponent(phone)
    );

    const bookings = await response.json();

    if (!response.ok) throw new Error(bookings.error);

    if (bookings.length === 0) {
      $("bookingResults").innerHTML = "<p>No bookings found.</p>";
      return;
    }

    $("bookingResults").innerHTML = bookings.map(b => `
      <div class="booking-card">
        <h3>${escapeHTML(b.movie)}</h3>
        <p><b>Booking ID:</b> ${escapeHTML(b.booking_code)}</p>
        <p><b>Date:</b> ${escapeHTML(b.show_date)}</p>
        <p><b>Time:</b> ${escapeHTML(b.show_time)}</p>
        <p><b>Seats:</b> ${escapeHTML(b.seats.join(", "))}</p>
        <p><b>Total:</b> ₹${b.total}</p>
        <p><b>Payment:</b> ${escapeHTML(b.payment)}</p>
        <p><b>Status:</b> Confirmed</p>
      </div>
    `).join("");

  } catch (error) {
    $("bookingResults").innerHTML =
      "<p>Could not load bookings. Please try again.</p>";
  }
}

// Set today's date as the earliest date
const today = new Date();
const localToday = new Date(
  today.getTime() - today.getTimezoneOffset() * 60000
).toISOString().split("T")[0];

$("date").min = localToday;
$("date").value = localToday;

$("date").addEventListener("change", () => {
  selectedSeats = [];
  updateTotal();
  loadSeats();
});

// Start website
loadMovies();


const savedUser = localStorage.getItem("cinebookUser");

if (savedUser) {
  try {
    currentUser = JSON.parse(savedUser);

    if (currentUser.name && /^[0-9]{10}$/.test(currentUser.phone)) {
      $("name").value = currentUser.name;
      $("phone").value = currentUser.phone;
      showPage("home");
    } else {
      localStorage.removeItem("cinebookUser");
      showPage("login");
    }
  } catch {
    localStorage.removeItem("cinebookUser");
    showPage("login");
  }
} else {
  showPage("login");
}