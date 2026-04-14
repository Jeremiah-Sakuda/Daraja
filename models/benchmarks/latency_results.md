# Daraja Model Latency Benchmarks

This document tracks inference latency for Daraja translation models across different hardware configurations.

## Test Methodology

- **Input**: 100 sample sentences from Flores-200 devtest
- **Measurement**: Wall-clock time from request to complete response
- **Metrics**: Average latency, P50, P95, P99
- **Warm-up**: 10 requests discarded before measurement

## Hardware Configurations

### Config A: Development Laptop
- CPU: Intel i7-12700H
- RAM: 32 GB
- GPU: NVIDIA RTX 3060 Mobile (6 GB)
- OS: Windows 11

### Config B: Server
- CPU: AMD EPYC 7742
- RAM: 128 GB
- GPU: NVIDIA A100 (40 GB)
- OS: Ubuntu 22.04

### Config C: Raspberry Pi 5 (Offline deployment test)
- CPU: Broadcom BCM2712
- RAM: 8 GB
- GPU: None (CPU only)
- OS: Raspberry Pi OS

## Results

### Somali → Swahili (q4_k_m)

*Results pending model training*

| Config | Avg Latency | P50 | P95 | P99 | Tokens/sec |
|--------|-------------|-----|-----|-----|------------|
| Config A (GPU) | TBD | TBD | TBD | TBD | TBD |
| Config A (CPU) | TBD | TBD | TBD | TBD | TBD |
| Config B (GPU) | TBD | TBD | TBD | TBD | TBD |
| Config C (CPU) | TBD | TBD | TBD | TBD | TBD |

### Latency by Input Length

| Input Length | Avg Output Length | Config A Latency |
|--------------|-------------------|------------------|
| Short (< 20 tokens) | TBD | TBD |
| Medium (20-50 tokens) | TBD | TBD |
| Long (50-100 tokens) | TBD | TBD |
| Very Long (> 100 tokens) | TBD | TBD |

## Target Performance

For usable real-time translation in interview settings:

| Metric | Target | Status |
|--------|--------|--------|
| Average latency (GPU) | < 2 seconds | Pending |
| Average latency (CPU) | < 5 seconds | Pending |
| P95 latency (GPU) | < 4 seconds | Pending |
| Offline viable (RPi) | < 10 seconds | Pending |

## Optimization Notes

### Achieved Optimizations

1. **Quantization**: Using q4_k_m reduces memory and improves latency
2. **Context length**: Limited to 2048 tokens (sufficient for interview responses)
3. **Temperature**: Low (0.3) for consistent, fast decoding

### Potential Further Optimizations

1. **Speculative decoding**: Could improve throughput
2. **Batching**: Not implemented (single-request use case)
3. **KV-cache optimization**: Default Ollama settings
4. **Model pruning**: Not explored

## Real-World Usage Patterns

### Interview Session Simulation

Simulating a 30-minute RSD interview with typical interaction patterns:

| Phase | Requests | Total Time | Avg Wait |
|-------|----------|------------|----------|
| Personal Info | ~15 | TBD | TBD |
| Flight Reasons | ~10 | TBD | TBD |
| Persecution Claims | ~8 | TBD | TBD |
| Total | ~33 | TBD | TBD |

### Medical Intake Simulation

| Phase | Requests | Total Time | Avg Wait |
|-------|----------|------------|----------|
| Chief Complaint | ~5 | TBD | TBD |
| Medical History | ~8 | TBD | TBD |
| Current Meds | ~4 | TBD | TBD |
| Total | ~17 | TBD | TBD |

## Benchmark Scripts

Benchmarks are run using:

```bash
# Install dependencies
pip install httpx tqdm

# Run benchmark
python scripts/benchmark_latency.py \
  --model daraja-so-sw \
  --input data/evaluation/flores_so.txt \
  --output results/latency_benchmark.json
```

## Notes

- All measurements taken with Ollama 0.3.x
- Results may vary based on concurrent system load
- GPU measurements use CUDA; Apple Silicon uses Metal
- "Offline viable" target based on acceptable user wait time in interview context
