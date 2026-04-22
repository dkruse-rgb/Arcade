document.addEventListener('DOMContentLoaded', () => {
  const title = document.querySelector('.hero p');
  const messages = [
    'Classic browser-game energy with a Dustin flavor.',
    'Railroad signal games, arcade experiments, and more.',
    'Built to grow one game at a time.'
  ];

  let index = 0;
  setInterval(() => {
    index = (index + 1) % messages.length;
    title.textContent = messages[index];
  }, 3000);
});
