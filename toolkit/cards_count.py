"""Print the number of cards in cards2.py (used by the smoke test and the Studio)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cards2 import CARDS
print(len(CARDS))
