import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

// Using a publicly accessible URL for the image to prevent module resolution errors.
const LOGIN_BACKGROUND_IMAGE_URL = 'https://user-gen-media-assets.s3.amazonaws.com/seedream_images/0f5b0114-24a6-420f-9d7b-27fa48a799f5.png';

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

      // Use a conditional key to store the token.
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
    // Use the public URL for the background image
    backgroundImage: `url(${LOGIN_BACKGROUND_IMAGE_URL})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    color: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    boxSizing: 'border-box',
    width: '100%',
  },
  formBox: {
    backgroundColor: 'rgba(30, 30, 47, 0.8)',
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
    color: '#fff',
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
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
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
    color: 'rgba(255, 255, 255, 0.7)',
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
