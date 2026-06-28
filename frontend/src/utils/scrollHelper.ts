export const scrollToInput = (inputId: string) => {
  setTimeout(() => {
    const input = document.getElementById(inputId);
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 300); // Wait for keyboard
};