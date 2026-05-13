#!/usr/bin/env python3
"""
Daraja Translation Model Latency Benchmark

Measures inference latency for Daraja translation models running on Ollama.
Outputs detailed timing metrics including average, P50, P95, P99 latencies.

Usage:
    python benchmark_latency.py --model daraja-so-sw --samples 100
    python benchmark_latency.py --model all --output results/latency_benchmark.json
"""

import argparse
import json
import statistics
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    import httpx
except ImportError:
    print("Error: httpx is required. Install with: pip install httpx")
    sys.exit(1)

# Default Ollama endpoint
OLLAMA_URL = "http://localhost:11434"

# Sample sentences for benchmarking (from Flores-200 style)
SAMPLE_SENTENCES = [
    "Hello, how are you today?",
    "I need medical assistance for my child.",
    "Where is the nearest hospital?",
    "I am seeking asylum in this country.",
    "My name is Ahmed and I come from Somalia.",
    "The journey was very difficult and dangerous.",
    "I have documents to prove my identity.",
    "Can you help me find my family members?",
    "I need a translator who speaks my language.",
    "Thank you for your help and support.",
    "When is my next appointment scheduled?",
    "I do not understand what you are saying.",
    "Please speak more slowly.",
    "I have been waiting for many hours.",
    "This is my first time applying for refugee status.",
    "I fled my country because of the war.",
    "My home was destroyed by the conflict.",
    "I have no money or possessions.",
    "Where can I get food and water?",
    "Is there a place where I can sleep safely?",
]

# Daraja model configurations
DARAJA_MODELS = {
    "so-sw": "daraja-so-sw",
    "ti-ar": "daraja-ti-ar",
    "prs-tr": "daraja-prs-tr",
    "sw-so": "daraja-sw-so",
    "ar-ti": "daraja-ar-ti",
    "tr-prs": "daraja-tr-prs",
}


@dataclass
class LatencyResult:
    """Single benchmark result for a translation request."""
    model: str
    input_text: str
    output_text: str
    latency_ms: float
    tokens_generated: int
    tokens_per_second: float
    success: bool
    error: Optional[str] = None


@dataclass
class BenchmarkSummary:
    """Aggregated benchmark results for a model."""
    model: str
    total_requests: int
    successful_requests: int
    failed_requests: int
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    min_latency_ms: float
    max_latency_ms: float
    avg_tokens_per_second: float
    timestamp: str
    hardware_config: str


def check_ollama_available(base_url: str = OLLAMA_URL) -> bool:
    """Check if Ollama is running and accessible."""
    try:
        response = httpx.get(f"{base_url}/api/tags", timeout=5.0)
        return response.status_code == 200
    except Exception:
        return False


def list_available_models(base_url: str = OLLAMA_URL) -> list[str]:
    """List all models available in Ollama."""
    try:
        response = httpx.get(f"{base_url}/api/tags", timeout=10.0)
        data = response.json()
        return [m["name"] for m in data.get("models", [])]
    except Exception as e:
        print(f"Error listing models: {e}")
        return []


def run_single_benchmark(
    model: str,
    text: str,
    base_url: str = OLLAMA_URL,
    timeout: float = 60.0
) -> LatencyResult:
    """Run a single translation benchmark request."""
    prompt = f"Translate the following text:\n{text}"

    start_time = time.perf_counter()

    try:
        response = httpx.post(
            f"{base_url}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "top_p": 0.9,
                    "num_predict": 256,
                }
            },
            timeout=timeout
        )

        end_time = time.perf_counter()
        latency_ms = (end_time - start_time) * 1000

        if response.status_code != 200:
            return LatencyResult(
                model=model,
                input_text=text,
                output_text="",
                latency_ms=latency_ms,
                tokens_generated=0,
                tokens_per_second=0,
                success=False,
                error=f"HTTP {response.status_code}: {response.text[:100]}"
            )

        data = response.json()
        output_text = data.get("response", "")
        eval_count = data.get("eval_count", 0)
        eval_duration_ns = data.get("eval_duration", 1)
        tokens_per_second = eval_count / (eval_duration_ns / 1e9) if eval_duration_ns > 0 else 0

        return LatencyResult(
            model=model,
            input_text=text,
            output_text=output_text,
            latency_ms=latency_ms,
            tokens_generated=eval_count,
            tokens_per_second=tokens_per_second,
            success=True
        )

    except httpx.TimeoutException:
        end_time = time.perf_counter()
        return LatencyResult(
            model=model,
            input_text=text,
            output_text="",
            latency_ms=(end_time - start_time) * 1000,
            tokens_generated=0,
            tokens_per_second=0,
            success=False,
            error="Request timed out"
        )
    except Exception as e:
        end_time = time.perf_counter()
        return LatencyResult(
            model=model,
            input_text=text,
            output_text="",
            latency_ms=(end_time - start_time) * 1000,
            tokens_generated=0,
            tokens_per_second=0,
            success=False,
            error=str(e)
        )


def run_benchmark(
    model: str,
    samples: int = 100,
    warmup: int = 10,
    base_url: str = OLLAMA_URL
) -> tuple[list[LatencyResult], BenchmarkSummary]:
    """Run complete benchmark for a model."""
    print(f"\nBenchmarking model: {model}")
    print(f"  Warmup requests: {warmup}")
    print(f"  Benchmark requests: {samples}")

    # Warmup phase
    print("  Running warmup...")
    for i in range(warmup):
        text = SAMPLE_SENTENCES[i % len(SAMPLE_SENTENCES)]
        run_single_benchmark(model, text, base_url)

    # Benchmark phase
    print("  Running benchmark...")
    results: list[LatencyResult] = []

    for i in range(samples):
        text = SAMPLE_SENTENCES[i % len(SAMPLE_SENTENCES)]
        result = run_single_benchmark(model, text, base_url)
        results.append(result)

        if (i + 1) % 10 == 0:
            print(f"    Completed {i + 1}/{samples} requests")

    # Calculate statistics
    successful_results = [r for r in results if r.success]
    failed_results = [r for r in results if not r.success]

    if not successful_results:
        print("  WARNING: All requests failed!")
        return results, BenchmarkSummary(
            model=model,
            total_requests=samples,
            successful_requests=0,
            failed_requests=len(failed_results),
            avg_latency_ms=0,
            p50_latency_ms=0,
            p95_latency_ms=0,
            p99_latency_ms=0,
            min_latency_ms=0,
            max_latency_ms=0,
            avg_tokens_per_second=0,
            timestamp=datetime.utcnow().isoformat(),
            hardware_config="Unknown"
        )

    latencies = [r.latency_ms for r in successful_results]
    tokens_per_sec = [r.tokens_per_second for r in successful_results if r.tokens_per_second > 0]

    sorted_latencies = sorted(latencies)
    p50_idx = int(len(sorted_latencies) * 0.50)
    p95_idx = int(len(sorted_latencies) * 0.95)
    p99_idx = int(len(sorted_latencies) * 0.99)

    summary = BenchmarkSummary(
        model=model,
        total_requests=samples,
        successful_requests=len(successful_results),
        failed_requests=len(failed_results),
        avg_latency_ms=statistics.mean(latencies),
        p50_latency_ms=sorted_latencies[p50_idx] if sorted_latencies else 0,
        p95_latency_ms=sorted_latencies[min(p95_idx, len(sorted_latencies) - 1)] if sorted_latencies else 0,
        p99_latency_ms=sorted_latencies[min(p99_idx, len(sorted_latencies) - 1)] if sorted_latencies else 0,
        min_latency_ms=min(latencies),
        max_latency_ms=max(latencies),
        avg_tokens_per_second=statistics.mean(tokens_per_sec) if tokens_per_sec else 0,
        timestamp=datetime.utcnow().isoformat(),
        hardware_config="Local development machine"
    )

    print(f"\n  Results for {model}:")
    print(f"    Success rate: {summary.successful_requests}/{summary.total_requests}")
    print(f"    Avg latency: {summary.avg_latency_ms:.1f}ms")
    print(f"    P50 latency: {summary.p50_latency_ms:.1f}ms")
    print(f"    P95 latency: {summary.p95_latency_ms:.1f}ms")
    print(f"    P99 latency: {summary.p99_latency_ms:.1f}ms")
    print(f"    Tokens/sec: {summary.avg_tokens_per_second:.1f}")

    return results, summary


def update_latency_results_md(
    summaries: list[BenchmarkSummary],
    output_path: Path
) -> None:
    """Update the latency_results.md file with benchmark data."""
    md_path = output_path.parent.parent / "models" / "benchmarks" / "latency_results.md"

    if not md_path.exists():
        print(f"Warning: {md_path} not found, skipping markdown update")
        return

    content = md_path.read_text()

    # Generate new results table
    for summary in summaries:
        # This is a simple replacement - in production you'd parse and update properly
        print(f"  Would update {md_path} with results for {summary.model}")

    print(f"\nNote: Run this script to generate actual benchmark data for latency_results.md")


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark Daraja translation model latency"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="daraja-so-sw",
        help="Model to benchmark (use 'all' for all Daraja models, or 'list' to show available)"
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=100,
        help="Number of benchmark samples (default: 100)"
    )
    parser.add_argument(
        "--warmup",
        type=int,
        default=10,
        help="Number of warmup requests (default: 10)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="results/latency_benchmark.json",
        help="Output file path for JSON results"
    )
    parser.add_argument(
        "--ollama-url",
        type=str,
        default=OLLAMA_URL,
        help="Ollama API URL (default: http://localhost:11434)"
    )

    args = parser.parse_args()

    # Check Ollama availability
    if not check_ollama_available(args.ollama_url):
        print(f"Error: Ollama is not available at {args.ollama_url}")
        print("Please ensure Ollama is running: ollama serve")
        sys.exit(1)

    available_models = list_available_models(args.ollama_url)
    print(f"Available models: {available_models}")

    if args.model == "list":
        print("\nDaraja models configuration:")
        for pair, model in DARAJA_MODELS.items():
            status = "available" if model in available_models else "not installed"
            print(f"  {pair}: {model} ({status})")
        sys.exit(0)

    # Determine which models to benchmark
    if args.model == "all":
        models_to_benchmark = [m for m in DARAJA_MODELS.values() if m in available_models]
        if not models_to_benchmark:
            print("Error: No Daraja models found. Install with: ollama pull <model>")
            sys.exit(1)
    else:
        if args.model not in available_models:
            print(f"Warning: Model {args.model} not found in Ollama")
            print(f"Available models: {available_models}")
            print("Proceeding anyway (will fail if model doesn't exist)...")
        models_to_benchmark = [args.model]

    # Run benchmarks
    all_results: list[LatencyResult] = []
    all_summaries: list[BenchmarkSummary] = []

    for model in models_to_benchmark:
        results, summary = run_benchmark(
            model=model,
            samples=args.samples,
            warmup=args.warmup,
            base_url=args.ollama_url
        )
        all_results.extend(results)
        all_summaries.append(summary)

    # Save results
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    output_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "config": {
            "samples": args.samples,
            "warmup": args.warmup,
            "ollama_url": args.ollama_url,
        },
        "summaries": [asdict(s) for s in all_summaries],
        "results": [asdict(r) for r in all_results],
    }

    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)

    print(f"\nResults saved to: {output_path}")

    # Update markdown file
    update_latency_results_md(all_summaries, output_path)


if __name__ == "__main__":
    main()
