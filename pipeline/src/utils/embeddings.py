"""Multilingual embedding utilities for semantic similarity.

Provides abstractions for working with multilingual sentence embeddings,
primarily using LaBSE for cross-lingual semantic similarity.
"""

import logging
from pathlib import Path
from typing import List, Optional, Tuple, Union
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MultilingualEmbeddings:
    """Wrapper for multilingual sentence embeddings."""

    SUPPORTED_MODELS = {
        "labse": "sentence-transformers/LaBSE",
        "xlm-roberta": "sentence-transformers/xlm-r-100langs-bert-base-nli-stsb-mean-tokens",
        "multilingual-e5": "intfloat/multilingual-e5-large",
        "paraphrase-multilingual": "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
    }

    def __init__(
        self,
        model_name: str = "labse",
        device: Optional[str] = None,
        cache_dir: Optional[str] = None
    ):
        """Initialize embedding model.

        Args:
            model_name: Model identifier (labse, xlm-roberta, etc.) or HF path
            device: Device to run on (cuda/cpu/None for auto)
            cache_dir: Directory to cache model weights
        """
        # Resolve model name
        if model_name in self.SUPPORTED_MODELS:
            self.model_path = self.SUPPORTED_MODELS[model_name]
        else:
            self.model_path = model_name

        self.device = device
        self.cache_dir = cache_dir
        self.model = None
        self._embedding_dim = None

    def load(self):
        """Load the embedding model."""
        if self.model is not None:
            return

        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            logger.error(
                "sentence-transformers required: pip install sentence-transformers"
            )
            raise

        logger.info(f"Loading embedding model: {self.model_path}")
        self.model = SentenceTransformer(
            self.model_path,
            device=self.device,
            cache_folder=self.cache_dir
        )
        self._embedding_dim = self.model.get_sentence_embedding_dimension()
        logger.info(f"Model loaded. Embedding dimension: {self._embedding_dim}")

    @property
    def embedding_dim(self) -> int:
        """Get embedding dimension."""
        if self._embedding_dim is None:
            self.load()
        return self._embedding_dim

    def encode(
        self,
        texts: Union[str, List[str]],
        batch_size: int = 32,
        normalize: bool = True,
        show_progress: bool = False
    ) -> np.ndarray:
        """Encode texts to embeddings.

        Args:
            texts: Single text or list of texts
            batch_size: Batch size for encoding
            normalize: Whether to L2-normalize embeddings
            show_progress: Show progress bar

        Returns:
            NumPy array of shape (n_texts, embedding_dim)
        """
        self.load()

        if isinstance(texts, str):
            texts = [texts]

        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=show_progress,
            normalize_embeddings=normalize,
            convert_to_numpy=True
        )

        return embeddings

    def similarity(
        self,
        texts1: Union[str, List[str]],
        texts2: Union[str, List[str]]
    ) -> Union[float, np.ndarray]:
        """Compute pairwise cosine similarity.

        If single strings provided, returns float.
        If lists provided, returns similarity matrix.

        Args:
            texts1: First text(s)
            texts2: Second text(s)

        Returns:
            Similarity score(s)
        """
        single_input = isinstance(texts1, str) and isinstance(texts2, str)

        if isinstance(texts1, str):
            texts1 = [texts1]
        if isinstance(texts2, str):
            texts2 = [texts2]

        emb1 = self.encode(texts1, normalize=True)
        emb2 = self.encode(texts2, normalize=True)

        # Cosine similarity (embeddings are normalized)
        similarities = np.dot(emb1, emb2.T)

        if single_input:
            return float(similarities[0, 0])

        return similarities

    def find_similar(
        self,
        query: str,
        candidates: List[str],
        top_k: int = 5,
        threshold: Optional[float] = None
    ) -> List[Tuple[int, str, float]]:
        """Find most similar candidates to query.

        Args:
            query: Query text
            candidates: List of candidate texts
            top_k: Number of results to return
            threshold: Optional minimum similarity threshold

        Returns:
            List of (index, text, score) tuples, sorted by similarity
        """
        query_emb = self.encode(query, normalize=True)
        cand_embs = self.encode(candidates, normalize=True)

        scores = np.dot(cand_embs, query_emb.T).flatten()

        # Get top-k indices
        if threshold is not None:
            mask = scores >= threshold
            valid_indices = np.where(mask)[0]
            scores = scores[mask]
        else:
            valid_indices = np.arange(len(candidates))

        top_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in top_indices:
            orig_idx = valid_indices[idx]
            results.append((
                int(orig_idx),
                candidates[orig_idx],
                float(scores[idx])
            ))

        return results

    def batch_similarity(
        self,
        pairs: List[Tuple[str, str]],
        batch_size: int = 32
    ) -> List[float]:
        """Compute similarity for many pairs efficiently.

        Args:
            pairs: List of (text1, text2) tuples
            batch_size: Batch size for encoding

        Returns:
            List of similarity scores
        """
        texts1 = [p[0] for p in pairs]
        texts2 = [p[1] for p in pairs]

        emb1 = self.encode(texts1, batch_size=batch_size, normalize=True)
        emb2 = self.encode(texts2, batch_size=batch_size, normalize=True)

        # Element-wise dot product for paired similarities
        scores = np.sum(emb1 * emb2, axis=1)

        return scores.tolist()

    def cluster_sentences(
        self,
        sentences: List[str],
        n_clusters: int = 5,
        method: str = "kmeans"
    ) -> List[int]:
        """Cluster sentences by semantic similarity.

        Args:
            sentences: List of sentences to cluster
            n_clusters: Number of clusters
            method: Clustering method (kmeans, agglomerative)

        Returns:
            List of cluster labels
        """
        embeddings = self.encode(sentences, normalize=True)

        if method == "kmeans":
            from sklearn.cluster import KMeans
            clusterer = KMeans(n_clusters=n_clusters, random_state=42)
        elif method == "agglomerative":
            from sklearn.cluster import AgglomerativeClustering
            clusterer = AgglomerativeClustering(n_clusters=n_clusters)
        else:
            raise ValueError(f"Unknown clustering method: {method}")

        labels = clusterer.fit_predict(embeddings)
        return labels.tolist()

    def save_embeddings(
        self,
        texts: List[str],
        output_path: str,
        include_texts: bool = True
    ):
        """Save embeddings to file.

        Args:
            texts: Texts to embed
            output_path: Path to save (numpy .npz format)
            include_texts: Whether to include original texts
        """
        embeddings = self.encode(texts, show_progress=True)

        save_dict = {"embeddings": embeddings}
        if include_texts:
            save_dict["texts"] = np.array(texts, dtype=object)

        np.savez_compressed(output_path, **save_dict)
        logger.info(f"Saved {len(texts)} embeddings to {output_path}")

    @staticmethod
    def load_embeddings(path: str) -> Tuple[np.ndarray, Optional[List[str]]]:
        """Load embeddings from file.

        Args:
            path: Path to .npz file

        Returns:
            Tuple of (embeddings, texts or None)
        """
        data = np.load(path, allow_pickle=True)
        embeddings = data["embeddings"]
        texts = data.get("texts")

        if texts is not None:
            texts = texts.tolist()

        return embeddings, texts


class SemanticDeduplicator:
    """Remove near-duplicate sentences using semantic similarity."""

    def __init__(
        self,
        embeddings: MultilingualEmbeddings,
        threshold: float = 0.95
    ):
        """Initialize deduplicator.

        Args:
            embeddings: Embedding model to use
            threshold: Similarity threshold for considering duplicates
        """
        self.embeddings = embeddings
        self.threshold = threshold

    def deduplicate(
        self,
        sentences: List[str],
        batch_size: int = 1000
    ) -> List[str]:
        """Remove semantically duplicate sentences.

        Uses greedy approach: keep first occurrence, remove later duplicates.

        Args:
            sentences: List of sentences
            batch_size: Batch size for processing

        Returns:
            Deduplicated list
        """
        if not sentences:
            return []

        logger.info(f"Deduplicating {len(sentences)} sentences...")

        # Encode all sentences
        embeddings = self.embeddings.encode(
            sentences,
            normalize=True,
            show_progress=True
        )

        # Greedy deduplication
        kept_indices = []
        kept_embeddings = []

        for i, emb in enumerate(embeddings):
            if i % 1000 == 0:
                logger.info(f"Processing {i}/{len(sentences)}")

            is_duplicate = False
            if kept_embeddings:
                # Check similarity with kept embeddings
                kept_array = np.array(kept_embeddings)
                sims = np.dot(kept_array, emb)
                if np.max(sims) >= self.threshold:
                    is_duplicate = True

            if not is_duplicate:
                kept_indices.append(i)
                kept_embeddings.append(emb)

        result = [sentences[i] for i in kept_indices]
        logger.info(f"Kept {len(result)}/{len(sentences)} sentences")

        return result

    def deduplicate_parallel(
        self,
        source_sentences: List[str],
        target_sentences: List[str]
    ) -> Tuple[List[str], List[str]]:
        """Deduplicate parallel corpus based on source similarity.

        Args:
            source_sentences: Source language sentences
            target_sentences: Aligned target sentences

        Returns:
            Tuple of (deduped_sources, deduped_targets)
        """
        if len(source_sentences) != len(target_sentences):
            raise ValueError("Source and target must have same length")

        logger.info(f"Deduplicating {len(source_sentences)} parallel pairs...")

        embeddings = self.embeddings.encode(
            source_sentences,
            normalize=True,
            show_progress=True
        )

        kept_indices = []
        kept_embeddings = []

        for i, emb in enumerate(embeddings):
            is_duplicate = False
            if kept_embeddings:
                kept_array = np.array(kept_embeddings)
                sims = np.dot(kept_array, emb)
                if np.max(sims) >= self.threshold:
                    is_duplicate = True

            if not is_duplicate:
                kept_indices.append(i)
                kept_embeddings.append(emb)

        deduped_source = [source_sentences[i] for i in kept_indices]
        deduped_target = [target_sentences[i] for i in kept_indices]

        logger.info(f"Kept {len(deduped_source)}/{len(source_sentences)} pairs")

        return deduped_source, deduped_target


if __name__ == "__main__":
    # Example usage
    print("Testing MultilingualEmbeddings...")

    # This will only work if sentence-transformers is installed
    try:
        embeddings = MultilingualEmbeddings(model_name="labse")

        # Test similarity
        sim = embeddings.similarity(
            "Hello, how are you?",
            "Habari, hujambo?"
        )
        print(f"Cross-lingual similarity: {sim:.3f}")

        # Test find similar
        query = "I need medical help"
        candidates = [
            "I require healthcare assistance",
            "The weather is nice today",
            "Please help me find a doctor",
            "I like to read books"
        ]

        results = embeddings.find_similar(query, candidates, top_k=3)
        print("\nMost similar to query:")
        for idx, text, score in results:
            print(f"  {score:.3f}: {text}")

    except ImportError:
        print("sentence-transformers not installed, skipping test")
