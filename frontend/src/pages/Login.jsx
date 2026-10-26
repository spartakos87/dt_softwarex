import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";


function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.append("username", username);
      body.append("password", password);

      const res = await axios.post(`${API_BASE}/login`, body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = res.data && res.data.access_token;
      if (!token) throw new Error("No token in response");

      sessionStorage.setItem("token", token);
      navigate("/dashboard");
    } catch (err) {
      const detail =
        (err.response && err.response.data && err.response.data.detail) ||
        err.message ||
        "Invalid credentials. Please try again.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h2 style={styles.title}>Login</h2>
        {error ? <p style={styles.error}>{error}</p> : null}
        <input
          style={styles.input}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <input
          type="password"
          style={styles.input}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(to right, #2c3e50, #4ca1af)",
    fontFamily: "Segoe UI, sans-serif",
  },
  form: {
    background: "white",
    padding: "2rem",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    width: "100%",
    maxWidth: "400px",
    display: "flex",
    flexDirection: "column",
  },
  title: {
    textAlign: "center",
    marginBottom: "1.5rem",
    color: "#333",
  },
  input: {
    padding: "0.8rem",
    marginBottom: "1rem",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "1rem",
  },
  button: {
    padding: "0.8rem",
    background: "#3498db",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "bold",
  },
  error: {
    color: "red",
    marginBottom: "1rem",
    textAlign: "center",
  },
};

export default Login;
