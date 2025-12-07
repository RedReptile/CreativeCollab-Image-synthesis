import React, { useState } from 'react';

/**
 * Hook: hold synthesis state + handlers
 */
export function useSynthesis() {
    const [prompt, setPrompt] = useState('');
    const [images, setImages] = useState([]); // array of { id, url }
    const [loading, setLoading] = useState(false);

    async function handleGenerate() {
        setLoading(true);
        try {
            // replace with real API call
            await new Promise(r => setTimeout(r, 600)); 
            // mock generated images
            setImages([
                { id: 1, url: 'https://via.placeholder.com/256?text=1' },
                { id: 2, url: 'https://via.placeholder.com/256?text=2' }
            ]);
        } finally {
            setLoading(false);
        }
    }

    function handleSelect(id) {
        // example: toggle selected flag or open preview
        console.log('selected', id);
    }

    return { prompt, setPrompt, images, loading, handleGenerate, handleSelect };
}

/**
 * Presentational / small components used by ImagesSynthesis.js
 */
export function Controls({ prompt, setPrompt, onGenerate, loading }) {
    return (
        <div className="synthesis-controls">
            <input
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe image..."
            />
            <button onClick={onGenerate} disabled={loading}>
                {loading ? 'Generating...' : 'Generate'}
            </button>
        </div>
    );
}

export function Preview({ images = [], onSelect }) {
    return (
        <div className="synthesis-preview">
            {images.map(img => (
                <img
                    key={img.id}
                    src={img.url}
                    alt=""
                    onClick={() => onSelect(img.id)}
                    style={{ width: 120, height: 120, objectFit: 'cover', margin: 8, cursor: 'pointer' }}
                />
            ))}
        </div>
    );
}

export function Results({ images = [] }) {
    return (
        <div className="synthesis-results">
            <h4>Results</h4>
            <ul>
                {images.map(img => (
                    <li key={img.id}>{img.url}</li>
                ))}
            </ul>
        </div>
    );
}

export default function ImagesSynthesis() {
    const {
        prompt,
        setPrompt,
        images,
        loading,
        handleGenerate,
        handleSelect
    } = useSynthesis();

    return (
        <div className="images-synthesis-ui">
            <h2>Image Synthesis</h2>

            <Controls
                prompt={prompt}
                setPrompt={setPrompt}
                onGenerate={handleGenerate}
                loading={loading}
            />

            <Preview images={images} onSelect={handleSelect} />

            <Results images={images} />
        </div>
    );
}