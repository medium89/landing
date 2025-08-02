// Дата
document.addEventListener('DOMContentLoaded', () => {
    const dateElements = document.querySelectorAll('[data-date-offset]');

    dateElements.forEach(element => {
        const date = new Date();
        
        const options = { year: 'numeric', month: 'numeric', day: 'numeric' };
        element.textContent = date.toLocaleDateString('ru-RU', options);
    });
});
