class Authenticator {
    constructor() {
        this.entries = [];
        this.currentEditId = null;
        this.sessionOnly = true; // Default to true
        
        // Load session preference from localStorage, default to true if not set
        this.sessionOnly = localStorage.getItem('sessionOnly') !== 'false';
        
        // Set checkbox state
        const sessionCheckbox = document.getElementById('sessionOnly');
        if (sessionCheckbox) {
            sessionCheckbox.checked = this.sessionOnly;
        }
        
        // Load entries based on session preference
        if (this.sessionOnly) {
            this.entries = JSON.parse(sessionStorage.getItem('entries')) || [];
        } else {
            this.entries = JSON.parse(localStorage.getItem('entries')) || [];
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.init();
                this.handleUrlParameters();
            });
        } else {
            this.init();
            this.handleUrlParameters();
        }
    }

    init() {
        this.setupEventListeners();
        this.renderEntries();
        this.updateInterval = setInterval(() => this.updateCodes(), 1000);
    }

    setupEventListeners() {
        // Add entry modal controls
        document.getElementById('addBtn').addEventListener('click', () => this.openAddModal());
        document.getElementById('cancelAdd').addEventListener('click', () => this.closeAddModal());
        document.getElementById('addModal').addEventListener('click', (e) => {
            if (e.target.id === 'addModal') {
                this.closeAddModal();
            }
        });

        document.getElementById('addEntryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addEntry();
        });

        // Edit modal controls
        document.getElementById('editEntryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEdit();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.closeEditModal();
        });

        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') {
                this.closeEditModal();
            }
        });

        // Import/Export controls
        document.getElementById('exportBtn').addEventListener('click', () => this.exportEntries());
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importEntries(e));

        // Add session mode toggle handler
        document.getElementById('sessionOnly').addEventListener('change', (e) => {
            this.sessionOnly = e.target.checked;
            localStorage.setItem('sessionOnly', this.sessionOnly);
            
            // Transfer existing entries to new storage
            const currentEntries = this.entries;
            if (this.sessionOnly) {
                localStorage.removeItem('entries');
                sessionStorage.setItem('entries', JSON.stringify(currentEntries));
            } else {
                sessionStorage.removeItem('entries');
                localStorage.setItem('entries', JSON.stringify(currentEntries));
            }
        });

        // Add tooltip explanation with updated text
        const infoIcon = document.querySelector('.info-icon');
        if (infoIcon) {
            infoIcon.title = `Store entries in temporary storage using sessionStorage\nwhich clears data when the tab is closed.`;
        }
    }

    openAddModal() {
        document.getElementById('addModal').style.display = 'block';
    }

    closeAddModal() {
        document.getElementById('addModal').style.display = 'none';
        document.getElementById('addEntryForm').reset();
    }

    addEntry() {
        const entry = {
            id: Date.now(),
            label: document.getElementById('label').value,
            secret: document.getElementById('secret').value,
            hashType: document.getElementById('hashType').value,
            period: parseInt(document.getElementById('period').value),
            digits: parseInt(document.getElementById('digits').value)
        };

        this.entries.push(entry);
        this.saveEntries();
        this.renderEntries();
        this.closeAddModal();
    }

    deleteEntry(id) {
        this.entries = this.entries.filter(entry => entry.id !== id);
        this.saveEntries();
        this.renderEntries();
    }

    editEntry(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return;

        this.currentEditId = id;

        // Populate the edit form
        document.getElementById('editLabel').value = entry.label;
        document.getElementById('editSecret').value = entry.secret;
        document.getElementById('editHashType').value = entry.hashType;
        document.getElementById('editPeriod').value = entry.period;
        document.getElementById('editDigits').value = entry.digits;

        // Show the modal
        document.getElementById('editModal').style.display = 'block';
    }

    saveEdit() {
        const updatedEntry = {
            id: this.currentEditId,
            label: document.getElementById('editLabel').value,
            secret: document.getElementById('editSecret').value,
            hashType: document.getElementById('editHashType').value,
            period: parseInt(document.getElementById('editPeriod').value),
            digits: parseInt(document.getElementById('editDigits').value)
        };

        // Replace the old entry with the updated one
        this.entries = this.entries.map(entry => 
            entry.id === this.currentEditId ? updatedEntry : entry
        );

        this.saveEntries();
        this.renderEntries();
        this.closeEditModal();
    }

    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
        document.getElementById('editEntryForm').reset();
        this.currentEditId = null;
    }

    generateCode(entry) {
        try {
            // Create new TOTP instance with period, digits, and hash type
            const totp = new jsOTP.totp(
                entry.period,
                entry.digits,
                entry.hashType
            );
            
            // Clean up secret (remove spaces and convert to uppercase)
            const cleanSecret = entry.secret.replace(/\s/g, '').toUpperCase();
            
            // Generate OTP
            const code = totp.getOtp(cleanSecret);
            
            // Pad with leading zeros if necessary
            return code.toString().padStart(entry.digits, '0');
        } catch (error) {
            console.error('Error generating code:', error);
            console.error('Entry:', { ...entry, secret: '***' }); // Log entry details without exposing secret
            return 'Error';
        }
    }

    updateCodes() {
        const epoch = Math.floor(Date.now() / 1000);
        this.entries.forEach(entry => {
            const codeElement = document.getElementById(`code-${entry.id}`);
            if (codeElement) {
                codeElement.textContent = this.generateCode(entry);
                
                // Update progress bar
                const timeRemaining = entry.period - (epoch % entry.period);
                const progressPercent = (timeRemaining / entry.period) * 100;
                codeElement.style.setProperty('--progress', `${progressPercent}%`);
            }
        });
    }

    renderEntries() {
        const container = document.getElementById('entriesList');
        
        if (this.entries.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
                    </svg>
                    <h2>No entries yet</h2>
                    <p>Click the "Add Entry" button above to add your first entry.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.entries.map(entry => `
            <div class="entry">
                <div class="entry-info">
                    <h3>${entry.label}</h3>
                    <div class="entry-code" id="code-${entry.id}">
                        ${this.generateCode(entry)}
                    </div>
                    <div class="entry-details">
                        <small>
                            Period: ${entry.period}s | 
                            Digits: ${entry.digits} | 
                            Hash: ${entry.hashType}
                        </small>
                    </div>
                </div>
                <div class="entry-actions">
                    <button data-action="edit" data-id="${entry.id}">Edit</button>
                    <button data-action="copy" data-id="${entry.id}">Copy</button>
                    <button data-action="delete" data-id="${entry.id}">Delete</button>
                </div>
            </div>
        `).join('');

        // Add event listeners for the buttons
        container.querySelectorAll('button[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const id = parseInt(e.target.dataset.id);
                if (action === 'edit') this.editEntry(id);
                if (action === 'delete') this.deleteEntry(id);
                if (action === 'copy') this.copyCode(id);
            });
        });
    }

    saveEntries() {
        if (this.sessionOnly) {
            sessionStorage.setItem('entries', JSON.stringify(this.entries));
        } else {
            localStorage.setItem('entries', JSON.stringify(this.entries));
        }
    }

    exportEntries() {
        const dataStr = JSON.stringify(this.entries, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'backup.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    importEntries(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedEntries = JSON.parse(e.target.result);
                    this.entries = importedEntries;
                    this.saveEntries();
                    this.renderEntries();
                } catch (error) {
                    alert('Invalid import file');
                }
            };
            reader.readAsText(file);
        }
    }

    async copyCode(id) {
        const codeElement = document.getElementById(`code-${id}`);
        if (codeElement) {
            try {
                await navigator.clipboard.writeText(codeElement.textContent.trim());
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        }
    }

    handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const secret = urlParams.get('secret');
        
        if (secret) {
            const entry = {
                id: Date.now(),
                label: urlParams.get('label') || 'Imported Entry',
                secret: secret,
                hashType: (urlParams.get('algorithm') || 'SHA1').toUpperCase(),
                period: parseInt(urlParams.get('period')) || 30,
                digits: parseInt(urlParams.get('digits')) || 6
            };

            // Validate parameters
            if (!['SHA1', 'SHA256', 'SHA512'].includes(entry.hashType)) {
                entry.hashType = 'SHA1';
            }
            if (entry.digits < 6 || entry.digits > 8) {
                entry.digits = 6;
            }
            if (entry.period < 1) {
                entry.period = 30;
            }

            this.entries.push(entry);
            this.saveEntries();
            this.renderEntries();

            // Clear the URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}

// Create the authenticator instance
const authenticator = new Authenticator();
