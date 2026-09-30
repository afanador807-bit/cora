import('https://esm.sh/three@0.179.1')
  .then((THREE) => {
    window.CORA_V20_THREE = THREE;
    window.dispatchEvent(new Event('cora-v20-three-ready'));
  })
  .catch(() => {
    window.CORA_V20_THREE_FAILED = true;
    window.dispatchEvent(new Event('cora-v20-three-failed'));
  });
