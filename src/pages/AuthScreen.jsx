import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config'; // ✅ Single source of truth for backend URL

const LOGIN_BACKGROUND_IMAGE_URL =
  'https://user-gen-media-assets.s3.amazonaws.com/seedream_images/0f5b0114-24a6-420f-9d7b-27fa48a799f5.png';

const AuthScreen = () => {
  const { role } = useParams(); // 'superadmin' or 'partner'
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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
        role: role,
      };

      // ✅ Use dynamic API base URL from config.js
      const response = await axios.post(`${API_BASE_URL}/auth/login`, payload);

      const { access_token, token, user_role } = response.data;

      // 🧠 Fallback logic for different backend token keys
      const finalToken = access_token || token;
      if (!finalToken) throw new Error('Token not found in response.');

      // ✅ Store under all possible keys for compatibility
      localStorage.setItem('auth_token', finalToken);
      localStorage.setItem('userToken', finalToken);
      localStorage.setItem('partner_token', finalToken);
      localStorage.setItem('user_role', user_role);

      // ✅ Navigate based on role
      if (user_role === 'superadmin') {
        navigate('/dashboard/superadmin');
      } else if (user_role === 'partner') {
        navigate('/dashboard/partner');
      } else {
        alert('Unknown role. Please contact admin.');
      }
    } catch (err) {
      console.error('Login failed:', err.response?.data || err.message);

      if (err.response?.status === 401) {
        setError('Invalid email or password. Please try again.');
      } else if (err.message.includes('Network Error')) {
        setError('Network error. Please check your internet connection.');
      } else {
        setError('Login failed. Please try again later.');
      }
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
              style={{
                ...authStyles.roleTab,
                ...(role === 'superadmin' ? authStyles.activeTab : {}),
              }}
              onClick={() => handleSwitchRole('superadmin')}
            >
              Super Admin
            </button>
            <button
              type="button"
              style={{
                ...authStyles.roleTab,
                ...(role === 'partner' ? authStyles.activeTab : {}),
              }}
              onClick={() => handleSwitchRole('partner')}
            >
              Partner (Store/POC)
            </button>
          </div>

          <h2 style={authStyles.formTitle}>
            Welcome back! Please login to your {displayRole} account
          </h2>

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
              <a href="#" style={authStyles.forgotPassword}>
                Forgot password?
              </a>
            </div>
            <button
              type="submit"
              style={authStyles.loginButton}
              disabled={loading}
            >
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
  checkbox: { marginRight: '5px' },
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
