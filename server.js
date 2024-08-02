import express from 'express';
import dotenv from 'dotenv';
import stripePackage from 'stripe';
import mongoose from 'mongoose';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

// Initialize app
const app = express();

// Resolve the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware to serve static files
app.use(express.static(join(__dirname, 'public')));

// Middleware
app.use(express.json());
app.use(cors({ origin: '*' }));

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/campusbite", {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("Connected to DB");
  } catch (error) {
    console.error("Error", error);
    console.error("Network Error");
  }
};

connectDB();

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

// Serve login/signup page by default
app.get('/', (req, res) => {
  res.sendFile('login.html', { root: join(__dirname, 'public') });
});

app.get('/signup', (req, res) => {
  res.sendFile('signup.html', { root: join(__dirname, 'public') });
});

// Redirect to index.html after successful login/signup
app.post('/api/signup', async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).send({ success: false, msg: "Passwords do not match" });
    }

    const newUser = new User({ fullName, email, password });
    await newUser.save();
    // res.redirect('/index.html');
  } catch (error) {
    console.error(error);
    return res.status(500).send({ success: false, error });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(400).send({ msg: "Invalid Credentials", success: false });
    }

    // res.redirect('/index.html');
  } catch (error) {
    console.error(error);
    return res.status(500).send({ success: false, error });
  }
});

// Serve index.html after successful login/signup
// app.get('/index.html', (req, res) => {
//   res.sendFile('index.html', { root: join(__dirname, 'public') });
// });

app.get('/success', (req, res) => {
  res.sendFile('success.html', { root: join(__dirname, 'public') });
});

app.get('/cancel', (req, res) => {
  res.sendFile('cancel.html', { root: join(__dirname, 'public') });
});

// Stripe
const stripe = stripePackage(process.env.stripe_api);
const DOMAIN = process.env.DOMAIN;

app.post('/stripe-checkout', async (req, res) => {
  try {
    const lineItems = req.body.items.map((item) => {
      const unitAmount = parseInt(item.price.replace(/[^0-9.-]+/g, '') * 1000);
      return {
        price_data: {
          currency: 'INR',
          product_data: {
            name: item.title,
            images: [item.productImg]
          },
          unit_amount: unitAmount,
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${DOMAIN}/success`,
      cancel_url: `${DOMAIN}/cancel`,
      line_items: lineItems,
      billing_address_collection: 'required'
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, error });
  }
});

app.listen(3000, () => {
  console.log('Listening on port 3000');
});
