#!/usr/bin/env python3
"""
Bulk Vector Database Population Script for CSEC Tutor

This script processes CSEC past papers and syllabi from local PDF files,
generates embeddings using sentence-transformers (no API required),
and populates the Supabase vector database.

Usage:
    cd csec-tutor/scripts
    pip install -r requirements.txt
    python bulk_populate_vectors.py

Requirements:
    - Python 3.9+
    - Supabase credentials in .env or .env.local
    - PDFs in data/past-papers/{subject}/ and data/syllabi/{subject}/
    - (Optional) Tesseract OCR for scanned documents
"""

import os
import re
import sys
from pathlib import Path
from typing import Optional
from datetime import datetime

# Load environment variables from .env.local
from dotenv import load_dotenv

# Find and load .env.local from project root
script_dir = Path(__file__).parent
project_root = script_dir.parent
env_file = project_root / '.env.local'
if env_file.exists():
    load_dotenv(env_file)
else:
    # Try .env as fallback
    load_dotenv(project_root / '.env')

# Now import other dependencies
import fitz  # PyMuPDF
from sentence_transformers import SentenceTransformer
from supabase import create_client, Client
from tqdm import tqdm

# Configuration
EMBEDDING_MODEL = 'all-MiniLM-L6-v2'  # 384 dimensions, fast and effective
EMBEDDING_DIMENSION = 384
CHUNK_SIZE = 500  # Characters per chunk
CHUNK_OVERLAP = 100  # Overlap between chunks
MIN_CHUNK_SIZE = 50  # Skip very small chunks
BATCH_SIZE = 50  # Upsert batch size

# Subject name normalization
SUBJECT_ALIASES = {
    'math': 'Mathematics',
    'maths': 'Mathematics',
    'mathematics': 'Mathematics',
    'bio': 'Biology',
    'biology': 'Biology',
    'chem': 'Chemistry',
    'chemistry': 'Chemistry',
    'phys': 'Physics',
    'physics': 'Physics',
    'english-a': 'English A',
    'english-b': 'English B',
    'english a': 'English A',
    'english b': 'English B',
    'englisha': 'English A',
    'englishb': 'English B',
    'history': 'Caribbean History',
    'caribbean-history': 'Caribbean History',
    'caribbean history': 'Caribbean History',
    'economics': 'Economics',
    'econ': 'Economics',
    'geography': 'Geography',
    'geo': 'Geography',
    'pob': 'Principles of Business',
    'principles-of-business': 'Principles of Business',
    'poa': 'Principles of Accounts',
    'principles-of-accounts': 'Principles of Accounts',
    'it': 'Information Technology',
    'information-technology': 'Information Technology',
    'cs': 'Computer Science',
    'social-studies': 'Social Studies',
    'spanish': 'Spanish',
    'french': 'French',
    'integrated-science': 'Integrated Science',
    'agricultural-science': 'Agricultural Science',
    'human-and-social-biology': 'Human and Social Biology',
    'hsb': 'Human and Social Biology',
    'visual-arts': 'Visual Arts',
    'music': 'Music',
    'physical-education': 'Physical Education',
    'pe': 'Physical Education',
    'office-administration': 'Office Administration',
    'theatre-arts': 'Theatre Arts',
    'electronic-document-preparation': 'Electronic Document Preparation',
    'edpm': 'Electronic Document Preparation',
    'food-and-nutrition': 'Food and Nutrition',
    'home-economics': 'Home Economics',
    'textiles-clothing-and-fashion': 'Textiles Clothing and Fashion',
    'technical-drawing': 'Technical Drawing',
    'building-technology': 'Building Technology',
    'electrical-and-electronic-technology': 'Electrical and Electronic Technology',
    'mechanical-engineering-technology': 'Mechanical Engineering Technology',
    'religious-education': 'Religious Education',
}


def get_supabase_client() -> Client:
    """Initialize Supabase client from environment variables."""
    url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    
    if not url or not key:
        print("Error: Supabase credentials not found in environment")
        print("Expected: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    return create_client(url, key)


def load_embedding_model() -> SentenceTransformer:
    """Load the sentence-transformers model."""
    print(f"Loading embedding model: {EMBEDDING_MODEL}...")
    model = SentenceTransformer(EMBEDDING_MODEL)
    print(f"Model loaded. Embedding dimension: {model.get_sentence_embedding_dimension()}")
    return model


def normalize_subject(folder_name: str) -> str:
    """Normalize subject name from folder name."""
    key = folder_name.lower().strip().replace('_', '-').replace(' ', '-')
    
    # Check direct alias match
    if key in SUBJECT_ALIASES:
        return SUBJECT_ALIASES[key]
    
    # Try partial matches
    for alias, canonical in SUBJECT_ALIASES.items():
        if alias in key or key in alias:
            return canonical
    
    # Fallback: title case the folder name
    return folder_name.replace('-', ' ').replace('_', ' ').title()


def extract_metadata_from_filename(filename: str, content_type: str) -> dict:
    """Extract year and paper info from filename."""
    metadata = {'source': filename, 'content_type': content_type}
    
    # Try to extract year
    year_match = re.search(r'(19|20)\d{2}', filename)
    if year_match:
        metadata['year'] = int(year_match.group())
    
    # Try to extract paper number
    paper_match = re.search(r'p(?:aper)?[_\-\s]?([123])|paper[_\-\s]?([123])', filename.lower())
    if paper_match:
        metadata['paper'] = int(paper_match.group(1) or paper_match.group(2))
    
    # Try to extract month
    if 'jan' in filename.lower():
        metadata['session'] = 'January'
    elif 'may' in filename.lower() or 'jun' in filename.lower():
        metadata['session'] = 'May/June'
    
    return metadata


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract text from PDF using PyMuPDF. Falls back to OCR if needed."""
    try:
        doc = fitz.open(pdf_path)
        text_parts = []
        
        for page_num, page in enumerate(doc):
            text = page.get_text()
            if text.strip():
                text_parts.append(f"[Page {page_num + 1}]\n{text}")
        
        doc.close()
        
        full_text = '\n\n'.join(text_parts)
        
        # If we got very little text, try OCR
        if len(full_text.strip()) < 100:
            ocr_text = try_ocr_extraction(pdf_path)
            if ocr_text and len(ocr_text) > len(full_text):
                return ocr_text
        
        return full_text
    
    except Exception as e:
        print(f"  Warning: Error reading {pdf_path.name}: {e}")
        return ""


def try_ocr_extraction(pdf_path: Path) -> str:
    """Attempt OCR extraction for scanned PDFs."""
    try:
        import pytesseract
        from pdf2image import convert_from_path
        
        # Convert PDF to images
        images = convert_from_path(pdf_path, dpi=150)
        text_parts = []
        
        for i, image in enumerate(images):
            text = pytesseract.image_to_string(image)
            if text.strip():
                text_parts.append(f"[Page {i + 1}]\n{text}")
        
        return '\n\n'.join(text_parts)
    
    except ImportError:
        # OCR dependencies not installed
        return ""
    except Exception as e:
        print(f"  OCR failed: {e}")
        return ""


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks for embedding."""
    if not text or len(text.strip()) < MIN_CHUNK_SIZE:
        return []
    
    # Clean text
    text = re.sub(r'\s+', ' ', text).strip()
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        
        # Try to break at sentence boundary
        if end < len(text):
            # Look for sentence end within last 100 chars of chunk
            search_start = max(end - 100, start)
            for punct in ['. ', '.\n', '? ', '!\n']:
                last_period = text.rfind(punct, search_start, end)
                if last_period > start:
                    end = last_period + 1
                    break
        
        chunk = text[start:end].strip()
        if len(chunk) >= MIN_CHUNK_SIZE:
            chunks.append(chunk)
        
        start = end - overlap
        if start >= len(text):
            break
    
    return chunks


def detect_topics(text: str, subject: str) -> list[str]:
    """Detect topics mentioned in the text based on subject."""
    topics = set()
    text_lower = text.lower()
    
    # Subject-specific topic detection
    topic_keywords = {
        'Mathematics': [
            ('algebra', ['algebra', 'equation', 'polynomial', 'factori', 'quadratic']),
            ('geometry', ['geometry', 'triangle', 'circle', 'angle', 'polygon', 'theorem']),
            ('trigonometry', ['trigonometry', 'sine', 'cosine', 'tangent', 'pythagor']),
            ('statistics', ['statistics', 'mean', 'median', 'mode', 'probability', 'data']),
            ('calculus', ['calculus', 'differentiat', 'integrat', 'derivative']),
            ('sets', ['sets', 'venn diagram', 'union', 'intersection']),
            ('functions', ['function', 'domain', 'range', 'mapping']),
            ('vectors', ['vector', 'scalar', 'magnitude', 'direction']),
            ('matrices', ['matrix', 'matrices', 'determinant']),
            ('mensuration', ['area', 'volume', 'surface area', 'perimeter']),
        ],
        'Biology': [
            ('cells', ['cell', 'membrane', 'nucleus', 'mitochondri', 'cytoplasm']),
            ('genetics', ['gene', 'dna', 'chromosome', 'heredit', 'mutation']),
            ('ecology', ['ecology', 'ecosystem', 'food chain', 'habitat', 'biodiversity']),
            ('human biology', ['human body', 'organ', 'digest', 'circulat', 'respir']),
            ('plant biology', ['photosynthesis', 'plant', 'chlorophyll', 'transpir']),
            ('evolution', ['evolution', 'natural selection', 'adaptation', 'species']),
        ],
        'Chemistry': [
            ('atomic structure', ['atom', 'electron', 'proton', 'neutron', 'isotope']),
            ('bonding', ['bond', 'ionic', 'covalent', 'metallic']),
            ('reactions', ['reaction', 'equation', 'product', 'reactant']),
            ('acids and bases', ['acid', 'base', 'ph', 'neutrali']),
            ('organic chemistry', ['organic', 'hydrocarbon', 'alkane', 'alkene']),
            ('electrochemistry', ['electrolysis', 'electrode', 'electrolyte']),
        ],
        'Physics': [
            ('mechanics', ['force', 'motion', 'velocity', 'acceleration', 'momentum']),
            ('waves', ['wave', 'frequency', 'wavelength', 'sound', 'light']),
            ('electricity', ['electric', 'current', 'voltage', 'resistance', 'circuit']),
            ('magnetism', ['magnet', 'magnetic field', 'electromagnet']),
            ('heat', ['heat', 'temperature', 'thermal', 'conduction', 'convection']),
            ('energy', ['energy', 'kinetic', 'potential', 'conservation']),
        ],
    }
    
    if subject in topic_keywords:
        for topic, keywords in topic_keywords[subject]:
            for keyword in keywords:
                if keyword in text_lower:
                    topics.add(topic)
                    break
    
    return list(topics) if topics else ['General']


def process_pdf(
    pdf_path: Path,
    subject: str,
    content_type: str,
    model: SentenceTransformer
) -> list[dict]:
    """Process a single PDF and return content records with embeddings."""
    records = []
    
    # Extract text
    text = extract_text_from_pdf(pdf_path)
    if not text:
        print(f"  Skipping {pdf_path.name}: no text extracted")
        return records
    
    # Get metadata
    metadata = extract_metadata_from_filename(pdf_path.name, content_type)
    
    # Detect topics
    topics = detect_topics(text, subject)
    
    # Chunk text
    chunks = chunk_text(text)
    
    if not chunks:
        print(f"  Skipping {pdf_path.name}: no valid chunks")
        return records
    
    # Generate embeddings for all chunks at once (batch processing)
    embeddings = model.encode(chunks, show_progress_bar=False)
    
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        for topic in topics:
            records.append({
                'subject': subject,
                'topic': topic,
                'subtopic': f"Chunk {i + 1}",
                'content_type': content_type,
                'content': chunk,
                'metadata': {**metadata, 'chunk_index': i, 'total_chunks': len(chunks)},
                'embedding': embedding.tolist()
            })
    
    return records


def clear_existing_content(supabase: Client):
    """Clear existing content from the table."""
    print("Clearing existing content...")
    try:
        supabase.table('csec_content').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        print("Existing content cleared.")
    except Exception as e:
        print(f"Warning: Could not clear existing content: {e}")


def upsert_records(supabase: Client, records: list[dict]):
    """Batch upsert records to Supabase."""
    if not records:
        return
    
    # Upload in batches
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i + BATCH_SIZE]
        try:
            supabase.table('csec_content').insert(batch).execute()
        except Exception as e:
            print(f"  Error upserting batch: {e}")
            # Try one by one
            for record in batch:
                try:
                    supabase.table('csec_content').insert(record).execute()
                except Exception as e2:
                    print(f"  Error upserting record: {e2}")


def main():
    """Main entry point."""
    print("=" * 60)
    print("CSEC Tutor - Bulk Vector Database Population")
    print("=" * 60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Initialize
    supabase = get_supabase_client()
    model = load_embedding_model()
    
    # Define data directories
    data_dir = project_root / 'data'
    past_papers_dir = data_dir / 'past-papers'
    syllabi_dir = data_dir / 'syllabi'
    
    # Collect all PDFs
    pdf_files = []
    
    # Past papers
    if past_papers_dir.exists():
        for subject_dir in past_papers_dir.iterdir():
            if subject_dir.is_dir():
                for pdf_file in subject_dir.glob('*.pdf'):
                    pdf_files.append((pdf_file, normalize_subject(subject_dir.name), 'question'))
    
    # Syllabi
    if syllabi_dir.exists():
        for subject_dir in syllabi_dir.iterdir():
            if subject_dir.is_dir():
                for pdf_file in subject_dir.glob('*.pdf'):
                    pdf_files.append((pdf_file, normalize_subject(subject_dir.name), 'syllabus'))
    
    if not pdf_files:
        print("No PDF files found in data/past-papers or data/syllabi")
        print("Expected structure:")
        print("  data/past-papers/{subject}/*.pdf")
        print("  data/syllabi/{subject}/*.pdf")
        sys.exit(1)
    
    print(f"Found {len(pdf_files)} PDF files to process")
    print()
    
    # Ask about clearing existing content (skip in non-interactive / --no-clear mode)
    if '--clear' in sys.argv:
        clear_existing_content(supabase)
    elif '--no-clear' not in sys.argv and sys.stdin.isatty():
        response = input("Clear existing content before populating? (y/N): ").strip().lower()
        if response == 'y':
            clear_existing_content(supabase)
    else:
        print("Keeping existing content (non-interactive mode or --no-clear flag)")
    
    # Process PDFs
    all_records = []
    
    print("\nProcessing PDFs...")
    for pdf_path, subject, content_type in tqdm(pdf_files, desc="Processing"):
        tqdm.write(f"  {subject}: {pdf_path.name}")
        records = process_pdf(pdf_path, subject, content_type, model)
        all_records.extend(records)
        tqdm.write(f"    Generated {len(records)} chunks")
    
    print(f"\nTotal records to upload: {len(all_records)}")
    
    # Upload to Supabase
    print("\nUploading to Supabase...")
    upsert_records(supabase, all_records)
    
    # Summary
    print()
    print("=" * 60)
    print("Complete!")
    print("=" * 60)
    print(f"Processed: {len(pdf_files)} PDFs")
    print(f"Generated: {len(all_records)} content chunks")
    print(f"Embedding dimension: {EMBEDDING_DIMENSION}")
    print()
    print("Verification query:")
    print("  SELECT COUNT(*) FROM csec_content WHERE embedding IS NOT NULL;")
    print()


if __name__ == '__main__':
    main()
