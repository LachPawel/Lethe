#!/usr/bin/env python3
"""
Lethe Python Wrapper
Easy integration with Python data pipelines
"""

import requests
import json
from typing import Optional, List, Dict
from dataclasses import dataclass


@dataclass
class AnonymizationResult:
    original: str
    anonymized: str
    entities: List[Dict]
    synthetic: Optional[str] = None


class LetheClient:
    """Client for Lethe anonymization API"""
    
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url.rstrip('/')
    
    def anonymize(self, text: str, generate_synthetic: bool = False) -> AnonymizationResult:
        """Anonymize a single text"""
        response = requests.post(
            f"{self.base_url}/api/anonymize",
            json={"text": text, "generateSynthetic": generate_synthetic}
        )
        response.raise_for_status()
        data = response.json()
        
        return AnonymizationResult(
            original=data.get('original', text),
            anonymized=data.get('anonymized', ''),
            entities=data.get('entities', []),
            synthetic=data.get('synthetic')
        )
    
    def anonymize_batch(self, texts: List[str], generate_synthetic: bool = False) -> List[AnonymizationResult]:
        """Anonymize multiple texts"""
        response = requests.post(
            f"{self.base_url}/api/anonymize/batch",
            json={"texts": texts, "generateSynthetic": generate_synthetic}
        )
        response.raise_for_status()
        data = response.json()
        
        return [
            AnonymizationResult(
                original=r.get('original', ''),
                anonymized=r.get('anonymized', ''),
                entities=r.get('entities', []),
                synthetic=r.get('synthetic')
            )
            for r in data.get('results', [])
        ]
    
    def anonymize_file(self, file_path: str, generate_synthetic: bool = False) -> AnonymizationResult:
        """Anonymize a text file"""
        with open(file_path, 'rb') as f:
            response = requests.post(
                f"{self.base_url}/api/anonymize/file",
                files={"file": f},
                data={"generateSynthetic": str(generate_synthetic).lower()}
            )
        response.raise_for_status()
        data = response.json()
        
        return AnonymizationResult(
            original=data.get('original', ''),
            anonymized=data.get('anonymized', ''),
            entities=data.get('entities', []),
            synthetic=data.get('synthetic')
        )


# Convenience function
def anonymize(text: str, generate_synthetic: bool = False, base_url: str = "http://localhost:3001") -> AnonymizationResult:
    """Quick anonymization function"""
    client = LetheClient(base_url)
    return client.anonymize(text, generate_synthetic)


# Example usage
if __name__ == "__main__":
    client = LetheClient()
    
    text = "Nazywam się Jan Kowalski, mój PESEL to 90010112345. Mieszkam w Warszawie przy ul. Długiej 5."
    
    result = client.anonymize(text, generate_synthetic=True)
    
    print("📄 Original:")
    print(result.original)
    print("\n🔒 Anonymized:")
    print(result.anonymized)
    print("\n🏷️ Entities:")
    for ent in result.entities:
        print(f"  - {ent['text']} → [{ent['label']}]")
    if result.synthetic:
        print("\n🔄 Synthetic:")
        print(result.synthetic)
