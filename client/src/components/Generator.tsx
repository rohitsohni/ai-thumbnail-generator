import { Download, Loader2, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { createThumbnail } from "../lib/api";
import {
  aspectRatios,
  colorSchemes,
  dummyThumbnails,
  thumbnailStyles,
  type AspectRatio,
  type Thumbnail,
  type ThumbnailStyle,
} from "../lib/assets";

const ratioClass: Record<AspectRatio, string> = {
  "16:9": "ratioWide",
  "1:1": "ratioSquare",
  "9:16": "ratioTall",
};

export function Generator() {
  const [title, setTitle] = useState("Build an AI Thumbnail Generator App using React");
  const [style, setStyle] = useState<ThumbnailStyle>("Bold & Graphic");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [colorSchemeId, setColorSchemeId] = useState("vibrant");
  const [additionalDetails, setAdditionalDetails] = useState("add a shocked creator, glowing app UI, and big readable text");
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>(dummyThumbnails);
  const [selectedId, setSelectedId] = useState(dummyThumbnails[0]._id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => thumbnails.find((thumbnail) => thumbnail._id === selectedId) ?? thumbnails[0],
    [selectedId, thumbnails],
  );

  async function handleGenerate() {
    if (!title.trim()) {
      setError("Enter a video title first.");
      return;
    }

    setError("");
    setIsGenerating(true);
    try {
      const thumbnail = await createThumbnail({
        title,
        style,
        aspectRatio,
        colorSchemeId,
        additionalDetails,
      });
      setThumbnails((current) => [thumbnail, ...current]);
      setSelectedId(thumbnail._id);
    } catch {
      setError("Could not generate a thumbnail. Check that the server is running.");
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadSelected() {
    const link = document.createElement("a");
    link.href = selected.image_url;
    link.download = `${selected.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "thumbnail"}.svg`;
    document.body.append(link);
    link.click();
    link.remove();
  }

  return (
    <section className="generatorSection" id="generate">
      <div className="sectionIntro">
        <span className="eyebrow">AI thumbnail studio</span>
        <h2>Generate thumbnails that look ready for YouTube.</h2>
      </div>

      <div className="generatorGrid">
        <form className="controlPanel" onSubmit={(event) => event.preventDefault()}>
          <label>
            Video title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter your video title" />
          </label>

          <label>
            Additional details
            <textarea
              value={additionalDetails}
              onChange={(event) => setAdditionalDetails(event.target.value)}
              placeholder="Describe people, objects, expressions, layout, or text to include"
            />
          </label>

          <div className="fieldGroup">
            <span>Aspect ratio</span>
            <div className="segmented">
              {aspectRatios.map((ratio) => (
                <button
                  className={aspectRatio === ratio ? "active" : ""}
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <label>
            Style
            <select value={style} onChange={(event) => setStyle(event.target.value as ThumbnailStyle)}>
              {thumbnailStyles.map((thumbnailStyle) => (
                <option key={thumbnailStyle}>{thumbnailStyle}</option>
              ))}
            </select>
          </label>

          <div className="fieldGroup">
            <span>Color scheme</span>
            <div className="swatches">
              {colorSchemes.map((scheme) => (
                <button
                  aria-label={scheme.name}
                  className={colorSchemeId === scheme.id ? "swatch active" : "swatch"}
                  key={scheme.id}
                  type="button"
                  onClick={() => setColorSchemeId(scheme.id)}
                >
                  {scheme.colors.map((color) => (
                    <span key={color} style={{ backgroundColor: color }} />
                  ))}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="error">{error}</p> : null}

          <button className="generateButton" disabled={isGenerating} type="button" onClick={handleGenerate}>
            {isGenerating ? <Loader2 className="spin" size={20} /> : <WandSparkles size={20} />}
            {isGenerating ? "Generating..." : "Generate thumbnail"}
          </button>
        </form>

        <div className="previewPanel">
          <div className={`previewFrame ${ratioClass[selected.aspect_ratio]}`}>
            <img src={selected.image_url} alt={selected.title} />
          </div>
          <div className="previewMeta">
            <div>
              <strong>{selected.title}</strong>
              <span>{selected.style} / {selected.aspect_ratio}</span>
            </div>
            <button className="iconButton" type="button" onClick={downloadSelected} aria-label="Download thumbnail">
              <Download size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="gallery" id="gallery">
        {thumbnails.map((thumbnail) => (
          <button
            className={thumbnail._id === selected._id ? "thumbCard selected" : "thumbCard"}
            key={thumbnail._id}
            type="button"
            onClick={() => setSelectedId(thumbnail._id)}
          >
            <img src={thumbnail.image_url} alt={thumbnail.title} />
            <span>{thumbnail.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
