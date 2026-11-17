import psutil
import pynvml
import logging

logger = logging.getLogger(__name__)

class TelemetryService:
    def __init__(self):
        self.gpu_available = False
        self._init_nvml()

    def _init_nvml(self):
        """Inicializálja az NVIDIA NVML könyvtárat a GPU adatok eléréséhez."""
        try:
            pynvml.nvmlInit()
            self.gpu_available = True
            self.gpu_handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            gpu_name = pynvml.nvmlDeviceGetName(self.gpu_handle)
            logger.info(f"NVIDIA GPU sikeresen inicializálva: {gpu_name}")
        except Exception as e:
            logger.warning(
                f"NVIDIA GPU nem található vagy az NVML nem inicializálható: {e}. "
                "A rendszer CPU-only módban fog futni."
            )
            self.gpu_available = False

    def get_cpu_usage(self) -> float:
        """Visszaadja a CPU aktuális terheltségét százalékban."""
        return psutil.cpu_percent(interval=None)

    def get_ram_usage(self) -> dict:
        """Visszaadja a rendszermemória (RAM) használatát bájtban és százalékban."""
        mem = psutil.virtual_memory()
        return {
            "used_bytes": mem.used,
            "total_bytes": mem.total,
            "percent": mem.percent
        }

    def get_gpu_metrics(self) -> dict:
        """Kinyeri a dedikált NVIDIA GPU metrikákat (VRAM, terheltség, hőmérséklet)."""
        if not self.gpu_available:
            return {
                "available": False,
                "utilization_pct": 0.0,
                "vram_used_bytes": 0,
                "vram_total_bytes": 0,
                "vram_percent": 0.0,
                "temperature_celsius": 0.0
            }

        try:
            utilization = pynvml.nvmlDeviceGetUtilizationRates(self.gpu_handle)
            gpu_util = float(utilization.gpu)

            mem_info = pynvml.nvmlDeviceGetMemoryInfo(self.gpu_handle)
            vram_used = mem_info.used
            vram_total = mem_info.total
            vram_pct = round((vram_used / vram_total) * 100, 2) if vram_total > 0 else 0.0

            temp = pynvml.nvmlDeviceGetTemperature(self.gpu_handle, pynvml.NVML_TEMPERATURE_GPU)

            return {
                "available": True,
                "utilization_pct": gpu_util,
                "vram_used_bytes": vram_used,
                "vram_total_bytes": vram_total,
                "vram_percent": vram_pct,
                "temperature_celsius": float(temp)
            }
        except Exception as e:
            logger.error(f"Hiba történt a GPU adatok kiolvasása közben: {e}")
            return {"available": False, "error": str(e)}

    def get_all_metrics(self) -> dict:
        """Összegyűjti az összes hardver metrikát egyetlen szótárba (dict)."""
        ram = self.get_ram_usage()
        gpu = self.get_gpu_metrics()
        
        return {
            "cpu_usage_pct": self.get_cpu_usage(),
            "ram_usage_bytes": ram["used_bytes"],
            "ram_percent": ram["percent"],
            "gpu_utilization_pct": gpu["utilization_pct"],
            "vram_usage_bytes": gpu["vram_used_bytes"],
            "vram_percent": gpu["vram_percent"],
            "gpu_temp_celsius": gpu["temperature_celsius"],
            "gpu_available": gpu["available"]
        }

    def __del__(self):
        """Destruktor, ami lezárja az NVML-t, ha az objektum megsemmisül."""
        if self.gpu_available:
            try:
                pynvml.nvmlShutdown()
            except:
                pass

telemetry_service = TelemetryService()