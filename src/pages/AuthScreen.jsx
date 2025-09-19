import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
// 1. 🟢 Import the image using the specified file name
import loginBackgroundImage from "../assets/images/aquatrack_visual.png"; // Assuming AuthScreen is in `src/` or a sibling folder to `assets`. Adjust the relative path as needed.

const API_BASE_URL = 'https://aquatrack-backend.fly.dev'; // Your local backend URL

const AuthScreen = () => {
  const { role } = useParams(); // 'superadmin' or 'partner'
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); // State for handling login errors
  const [loading, setLoading] = useState(false);

  const displayRole = role === 'superadmin' ? 'Super Admin' : 'Partner (Store/POC)';

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        username: email,
        password: password,
        role: role
      };

      const response = await axios.post(`${API_BASE_URL}/auth/login`, payload);

      const { access_token, user_role } = response.data;

      // 🟢 CRITICAL FIX: Use a conditional key to store the token.
      const tokenKey = user_role === 'superadmin' ? 'userToken' : 'partner_token';
      localStorage.setItem(tokenKey, access_token);

      // Navigate to the correct dashboard based on the server response.
      navigate(`/dashboard/${user_role}`);

    } catch (err) {
      console.error('Login failed:', err.response?.data || err.message);
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchRole = (newRole) => {
    navigate(`/login/${newRole}`);
  };

  return (
    <div style={authStyles.container}>
      {/* The image is now a background on this div for better styling control.
        We have removed the <img /> tag entirely.
      */}
      <div style={authStyles.imageSection}>
        {/* The image is now a background, so no content is needed here */}
      </div>

      <div style={authStyles.formSection}>
        <form onSubmit={handleLogin} style={authStyles.formBox}>
          <div style={authStyles.roleSelectionTabs}>
            <button
              type="button"
              style={{ ...authStyles.roleTab, ...(role === 'superadmin' ? authStyles.activeTab : {}) }}
              onClick={() => handleSwitchRole('superadmin')}
            >
              Super Admin
            </button>
            <button
              type="button"
              style={{ ...authStyles.roleTab, ...(role === 'partner' ? authStyles.activeTab : {}) }}
              onClick={() => handleSwitchRole('partner')}
            >
              Partner (Store/POC)
            </button>
          </div>

          <h2 style={authStyles.formTitle}>Welcome back! Please login to your {displayRole} account</h2>

          {error && <p style={authStyles.errorText}>{error}</p>}

          <div style={authStyles.form}>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={authStyles.input}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={authStyles.input}
              required
            />

            <div style={authStyles.optionsRow}>
              <label style={authStyles.checkboxLabel}>
                <input type="checkbox" style={authStyles.checkbox} /> Remember me
              </label>
              <a href="#" style={authStyles.forgotPassword}>Forgot password?</a>
            </div>

            <button type="submit" style={authStyles.loginButton} disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const authStyles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: 'Arial, sans-serif',
    // 🎨 Updated: Use a solid color as the container background
    backgroundColor: '#1E1E2F',
    color: '#fff',
  },
  imageSection: {
    flex: 3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // 2. 🟢 Updated: Use the imported variable for the background image URL
    backgroundImage: `url(${loginBackgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    padding: '20px',
    boxSizing: 'border-box',

  },
  formSection: {
    flex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    boxSizing: 'border-box',
    // 🎨 New: Shift the form section to the right to reveal the logo
    transform: 'translateX(50px)',
  },
  formBox: {
    // 🎨 Updated: Changed the background to a more transparent blue-like color
    backgroundColor: 'rgba(0, 191, 255, 0.2)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '15px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  roleSelectionTabs: {
    display: 'flex',
    marginBottom: '25px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '5px',
  },
  roleTab: {
    padding: '10px 20px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'background-color 0.3s ease',
  },
  activeTab: {
    backgroundColor: '#007bff',
    fontWeight: 'bold',
  },
  formTitle: {
    fontSize: '1.2rem',
    fontWeight: 'normal',
    // 🎨 Updated: Changed the text color to a darker blue
    color: '#005b9f',
    marginBottom: '30px',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  input: {
    width: '100%',
    padding: '12px 15px',
    margin: '8px 0',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    // 🎨 Updated: Changed the input text color to a darker blue
    color: '#005b9f',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
    '::placeholder': {
      color: 'rgba(0, 0, 0, 0.6)',
    },
  },
  optionsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: '10px',
    marginBottom: '20px',
    fontSize: '0.9rem',
  },
  checkboxLabel: {
    // 🎨 Updated: Changed the checkbox label color to a darker blue
    color: '#005b9f',
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  checkbox: {
    marginRight: '5px',
  },
  forgotPassword: {
    color: '#007bff',
    textDecoration: 'none',
    transition: 'color 0.3s ease',
  },
  loginButton: {
    width: '100%',
    padding: '15px',
    marginTop: '15px',
    border: 'none',
    borderRadius: '8px',
    background: 'linear-gradient(to right, #007bff, #00C6FF)',
    color: 'white',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background 0.3s ease, transform 0.2s',
  },
  errorText: {
    color: '#FF4444',
    fontSize: '0.9rem',
    marginBottom: '10px',
  },
};

export default AuthScreen;