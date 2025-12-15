# Known Bugs & Limitations

### Terminal
- **Ghost Text**: Might flicker on rapid typing due to `useEffect` dependency updates.
- **Integrity Check**: If system is compromised, the 'Critical Error' banner might appear multiple times if not properly ref-guarded (Fixed with `useRef`).
