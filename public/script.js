let currentMode = 'text'; // 'text' or 'file'
let selectedFile = null;

function switchTab(mode) {
    currentMode = mode;
    const tabText = document.getElementById('tab-text');
    const tabFile = document.getElementById('tab-file');
    const inputTextContainer = document.getElementById('input-text-container');
    const inputFileContainer = document.getElementById('input-file-container');

    if (mode === 'text') {
        tabText.className = "w-32 py-2.5 text-sm font-medium leading-5 text-blue-700 bg-white shadow rounded-lg focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60 transition-all duration-200";
        tabFile.className = "w-32 py-2.5 text-sm font-medium leading-5 text-gray-400 hover:text-white rounded-lg focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60 transition-all duration-200";
        inputTextContainer.classList.remove('hidden');
        inputFileContainer.classList.add('hidden');
    } else {
        tabFile.className = "w-32 py-2.5 text-sm font-medium leading-5 text-blue-700 bg-white shadow rounded-lg focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60 transition-all duration-200";
        tabText.className = "w-32 py-2.5 text-sm font-medium leading-5 text-gray-400 hover:text-white rounded-lg focus:outline-none focus:ring-2 ring-offset-2 ring-offset-blue-400 ring-white ring-opacity-60 transition-all duration-200";
        inputTextContainer.classList.add('hidden');
        inputFileContainer.classList.remove('hidden');
    }
}

function clearInput() {
    document.getElementById('input-text').value = '';
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        handleFile(files[0]);
    }
    
    e.currentTarget.classList.remove('border-blue-500', 'bg-gray-800/50');
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    selectedFile = file;
    document.getElementById('upload-placeholder').classList.add('hidden');
    document.getElementById('file-info').classList.remove('hidden');
    document.getElementById('filename-display').textContent = file.name;
}

async function processData() {
    const synthetic = document.getElementById('synthetic-toggle').checked;
    const outputText = document.getElementById('output-text');
    const loadingOverlay = document.getElementById('loading-overlay');
    const statusText = document.getElementById('status-text');
    const processTime = document.getElementById('process-time');
    const processBtn = document.getElementById('process-btn');

    // Reset UI
    outputText.value = '';
    loadingOverlay.classList.remove('hidden');
    statusText.textContent = 'Przetwarzanie...';
    statusText.className = 'text-blue-400 animate-pulse';
    processBtn.disabled = true;
    
    const startTime = Date.now();

    try {
        let response;
        
        if (currentMode === 'text') {
            const text = document.getElementById('input-text').value;
            if (!text.trim()) throw new Error('Wprowadź tekst do anonimizacji');

            response = await fetch('/api/anonymize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, generateSynthetic: synthetic })
            });
        } else {
            if (!selectedFile) throw new Error('Wybierz plik do anonimizacji');

            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('generateSynthetic', synthetic);

            response = await fetch('/api/anonymize/file', {
                method: 'POST',
                body: formData
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Błąd serwera');
        }

        const data = await response.json();
        
        // Show result
        const result = (synthetic && data.synthetic) ? data.synthetic : data.anonymized;
        outputText.value = result;
        
        // Update status
        statusText.textContent = 'Zakończono pomyślnie';
        statusText.className = 'text-green-400';
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        processTime.textContent = `${duration}s`;

    } catch (error) {
        console.error(error);
        outputText.value = `Błąd: ${error.message}`;
        statusText.textContent = 'Błąd';
        statusText.className = 'text-red-400';
    } finally {
        loadingOverlay.classList.add('hidden');
        processBtn.disabled = false;
    }
}

function copyOutput() {
    const outputText = document.getElementById('output-text');
    outputText.select();
    document.execCommand('copy');
    
    // Visual feedback could be added here
}

function downloadOutput() {
    const text = document.getElementById('output-text').value;
    if (!text) return;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anonymized_output.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}
