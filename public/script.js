const input = document.getElementById('input');
const output = document.getElementById('output');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const syntheticCheckbox = document.getElementById('synthetic');
const loader = document.getElementById('loader');
const stats = document.getElementById('stats');
const entityCount = document.getElementById('entityCount');

// Auto-resize textarea logic could go here, but we used fixed height for simplicity

submitBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;

    // UI State: Loading
    setLoading(true);
    output.textContent = '';
    stats.classList.add('hidden');
    copyBtn.classList.add('hidden');

    try {
        const response = await fetch('/api/anonymize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                generateSynthetic: syntheticCheckbox.checked
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Display result
        // If synthetic is requested and available, show it. Otherwise show anonymized.
        const resultText = (syntheticCheckbox.checked && data.synthetic) 
            ? data.synthetic 
            : data.anonymized;

        output.textContent = resultText;
        
        // Update stats
        if (data.entities) {
            entityCount.textContent = data.entities.length;
            stats.classList.remove('hidden');
        }
        
        copyBtn.classList.remove('hidden');

    } catch (error) {
        console.error('Error:', error);
        output.innerHTML = `<span class="text-red-400">Wystąpił błąd: ${error.message}</span>`;
    } finally {
        setLoading(false);
    }
});

clearBtn.addEventListener('click', () => {
    input.value = '';
    output.textContent = '';
    stats.classList.add('hidden');
    copyBtn.classList.add('hidden');
    input.focus();
});

copyBtn.addEventListener('click', () => {
    const textToCopy = output.textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Skopiowano!';
        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    });
});

function setLoading(isLoading) {
    if (isLoading) {
        loader.classList.remove('hidden');
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        loader.classList.add('hidden');
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}
