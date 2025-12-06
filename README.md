# 🏛️ Lethe

**Polish PII Anonymization Tool** - Dane bez Twarzy

> Λήθη (Lethe) - w mitologii greckiej rzeka zapomnienia

## Opis

Narzędzie do automatycznej anonimizacji danych osobowych w tekstach polskich. Wykorzystuje hybrydowe podejście łączące:
- **Regex** - szybka detekcja danych strukturalnych (PESEL, email, telefon)
- **PLLuM API** - kontekstowa analiza NER (imiona, nazwiska, adresy)

### Funkcje

- ✅ Wykrywanie 24 kategorii danych osobowych
- ✅ Rozróżnianie kontekstu (`[city]` vs `[address]`)
- ✅ Obsługa polskiej fleksji (Kowalski → Kowalskiego → Kowalskiemu)
- ✅ Generacja danych syntetycznych z zachowaniem morfologii
- ✅ API REST + CLI

## Instalacja

```bash
git clone https://github.com/your-repo/lethe.git
cd lethe
npm install
cp .env.example .env
# Uzupełnij PLLUM_API_KEY w .env
```

## Konfiguracja

```env
PLLUM_API_KEY=your_api_key
PLLUM_BASE_URL=https://apim-pllum-tst-pcn.azure-api.net/vllm/v1
PLLUM_MODEL=CYFRAGOVPL/pllum-12b-nc-chat-250715
PORT=3003
```

## Użycie

### CLI

```bash
# Bezpośredni tekst
node cli.js -t "Jan Kowalski, PESEL 90010112345, mieszka w Warszawie"

# Plik
node cli.js -i input.txt -o output.json

# Z generacją syntetyczną
node src/cli.js -i input.txt -s
```

### API

```bash
# Start serwera
npm run dev

# Anonimizacja
curl -X POST http://localhost:3001/api/anonymize \
  -H "Content-Type: application/json" \
  -d '{"text": "Jan Kowalski, PESEL 90010112345"}'

# Z syntetyczną generacją
curl -X POST http://localhost:3001/api/anonymize \
  -H "Content-Type: application/json" \
  -d '{"text": "Jan Kowalski", "generateSynthetic": true}'
```

### Python

```python
import requests

response = requests.post('http://localhost:3001/api/anonymize', json={
    'text': 'Jan Kowalski, PESEL 90010112345, mieszka w Warszawie przy ul. Długiej 5.',
    'generateSynthetic': True
})

result = response.json()
print(result['anonymized'])
# Nazywam się [name] [surname], mój PESEL to [pesel]. Mieszkam w [address].
```

## Przykład

**Wejście:**
```
Nazywam się Jan Kowalski, mój PESEL to 90010112345. 
Mieszkam w Warszawie przy ulicy Długiej 5. 
Mój kolega Piotrek pożyczył mi 10zł, a potem Janek oddał 12zł.
```

**Wyjście (anonimizacja):**
```
Nazywam się [name] [surname], mój PESEL to [pesel]. 
Mieszkam w [address]. 
Mój kolega [name] pożyczył mi 10zł, a potem [name] oddał 12zł.
```

**Wyjście (syntetyczne):**
```
Nazywam się Maria Nowak, mój PESEL to 85062718394. 
Mieszkam w Krakowie przy ulicy Szerokiej 12. 
Mój kolega Stefan pożyczył mi 10zł, a potem Tomek oddał 12zł.
```

## Obsługiwane kategorie

| Kategoria | Token | Przykład |
|-----------|-------|----------|
| Imię | `[name]` | Jan, Ania, Piotrze |
| Nazwisko | `[surname]` | Kowalski, Nowakowi |
| PESEL | `[pesel]` | 90010112345 |
| Email | `[email]` | jan@example.pl |
| Telefon | `[phone]` | +48 123 456 789 |
| Adres | `[address]` | ul. Długa 5, 00-001 Warszawa |
| Miasto | `[city]` | byłem w Krakowie |
| Firma | `[company]` | pracuję w Google |
| Data urodzenia | `[date-of-birth]` | 01.01.1990 |
| Nr dokumentu | `[document-number]` | ABC123456 |
| Konto bankowe | `[bank-account]` | PL12345678901234567890123456 |
| ... | ... | ... |

Pełna lista 24 kategorii w dokumentacji.

## Architektura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Input     │────▶│   Regex     │────▶│   PLLuM     │
│   Text      │     │   Layer     │     │   NER       │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────────────────────┐
                    │      Merge & Replace        │
                    └─────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │   Synthetic Generation      │
                    │   (morphology-aware)        │
                    └─────────────────────────────┘
```

## Licencja

MIT

## Autorzy

Hackathon NASK 2024 - Dane bez Twarzy
