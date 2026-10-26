export default function logout() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("chatLog");
  window.location.href = "/";
}