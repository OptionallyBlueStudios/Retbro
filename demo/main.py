import requests
from bs4 import BeautifulSoup
import tkinter as tk
from tkinter import messagebox, filedialog

# Allowed ROM extensions
ROM_EXTENSIONS = (".gg", ".nes", ".snes", ".gba", ".gb", ".gbc", ".sms", ".smd", ".bin", ".a78")

def extract_rom_urls(url: str):
    try:
        response = requests.get(url)
        response.raise_for_status()
        html_content = response.text

        soup = BeautifulSoup(html_content, "html.parser")

        urls = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("//"):
                href = "https:" + href
            elif href.startswith("/"):
                href = "https://archive.org" + href

            # Only include ROM files
            if href.lower().endswith(ROM_EXTENSIONS):
                urls.append(href)

        return urls
    except Exception as e:
        messagebox.showerror("Error", f"Failed to fetch URL:\n{e}")
        return []

def save_urls():
    url = entry.get().strip()
    if not url:
        messagebox.showwarning("Input Needed", "Please enter a URL.")
        return

    urls = extract_rom_urls(url)
    if urls:
        # Ask user where to save the file
        save_path = filedialog.asksaveasfilename(
            defaultextension=".txt",
            filetypes=[("Text files", "*.txt")],
            title="Save URLs As..."
        )
        if save_path:
            with open(save_path, "w", encoding="utf-8") as f:
                for link in urls:
                    f.write(f'"{link}",\n')  # wrap in quotes and add comma
            messagebox.showinfo("Success", f"Extracted {len(urls)} ROM URLs to {save_path}")
    else:
        messagebox.showinfo("No ROMs", "No ROM files found in the provided text.")

# --- GUI ---
root = tk.Tk()
root.title("ROM URL Extractor")

label = tk.Label(root, text="Enter URL to file listing page:")
label.pack(pady=5)

entry = tk.Entry(root, width=60)
entry.pack(pady=5)

button = tk.Button(root, text="Extract & Save", command=save_urls)
button.pack(pady=10)

root.mainloop()
