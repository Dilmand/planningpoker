function handleJoin(e) {
    e.preventDefault();
    const code = document.getElementById('join-code').value.trim();
    const name = document.getElementById('join-name').value.trim();
    const error = document.getElementById('join-error');

    if (!/^[0-9]{6}$/.test(code)) {
        error.textContent = 'Room code must be 6 digits.';
    } else if (!name) {
        error.textContent = 'Name is required.';
    } else {
        error.textContent = '';
        console.log(`Joining room ${code} as ${name}`);
    }
}

function handleCreate(e) {
    e.preventDefault();
    const room = document.getElementById('create-name').value.trim();
    const facilitator = document.getElementById('facilitator-name').value.trim();
    const error = document.getElementById('create-error');

    if (!room) {
        error.textContent = 'Room name is required.';
    } else if (!facilitator) {
        error.textContent = 'Facilitator name is required.';
    } else {
        error.textContent = '';
        console.log(`Creating room "${room}" with facilitator "${facilitator}"`);
    }
}