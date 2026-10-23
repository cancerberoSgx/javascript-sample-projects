//! Additions to upstream pyegui made in this project (not part of pyegui 0.5.0).
//! Documented in EXTENSIONS.md.

use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

use eframe::egui;
use pyo3::exceptions::{PyKeyError, PyValueError};
use pyo3::prelude::*;
use pyo3::types::PyDict;

use crate::{current_ui, run_nested_update_func, Bool, UI};

// textures uploaded from Python, by name
static TEXTURES: LazyLock<Mutex<HashMap<String, egui::TextureHandle>>> =
    LazyLock::new(Default::default);

/// Upload raw RGBA pixels as a named texture, or replace the pixels of an existing one.
///
/// Unlike ``image("file://...")``, which egui caches by uri forever, the texture can be
/// updated at any time, so this is the way to show images generated or edited in Python.
/// Must be called inside update_func.
///
/// Args:
///     name (str): texture name, used by ``canvas``
///
///     width (int), height (int): size in pixels
///
///     rgba (bytes): ``width * height * 4`` bytes, unmultiplied RGBA
///
///     nearest (bool): use nearest-neighbour filtering instead of linear
///
/// Example::
///
///     img = PIL.Image.open("photo.png").convert("RGBA")
///     # inside update_func
///     set_texture("photo", img.width, img.height, img.tobytes())
///     canvas("photo")
#[pyfunction]
#[pyo3(signature = (name, width, height, rgba, nearest=false))]
pub unsafe fn set_texture(
    name: &str,
    width: usize,
    height: usize,
    rgba: &[u8],
    nearest: bool,
) -> PyResult<()> {
    if rgba.len() != width * height * 4 {
        return Err(PyValueError::new_err(format!(
            "expected {} bytes for a {width}x{height} RGBA image, got {}",
            width * height * 4,
            rgba.len()
        )));
    }
    let ui = current_ui(&UI)?;
    let image = egui::ColorImage::from_rgba_unmultiplied([width, height], rgba);
    let options = if nearest {
        egui::TextureOptions::NEAREST
    } else {
        egui::TextureOptions::LINEAR
    };

    let mut textures = TEXTURES.lock().unwrap();
    match textures.get_mut(name) {
        Some(handle) => handle.set(image, options),
        None => {
            let handle = ui.ctx().load_texture(name, image, options);
            textures.insert(name.to_owned(), handle);
        }
    }
    Ok(())
}

/// Free a texture created with ``set_texture``. Does nothing if it doesn't exist.
#[pyfunction]
pub fn free_texture(name: &str) {
    TEXTURES.lock().unwrap().remove(name);
}

/// Show a texture created with ``set_texture`` as an interactive surface and report
/// what the pointer does over it.
///
/// The texture is scaled down (keeping its aspect ratio) to fit the available space,
/// ``max_width`` and ``max_height``, and is never scaled up beyond ``max_scale``.
/// All coordinates, both arguments and returned values, are in texture pixels.
///
/// Args:
///     texture (str): texture name
///
///     max_width (float), max_height (float): size limits, default to the available space
///
///     max_scale (float): max zoom, default 1.0 (never upscale)
///
///     selection (tuple[float, float, float, float] | None): ``(x0, y0, x1, y1)`` rectangle
///     drawn on top of the image
///
///     stroke (list[tuple[float, float]] | None): polyline drawn on top of the image,
///     e.g. a brush stroke in progress
///
///     stroke_color (tuple[float, float, float]): rgb in 0..1, like ``RGB``
///
///     stroke_width (float): stroke width in texture pixels
///
///     cursor_radius (float | None): if set, draws a circle of this radius at the pointer
///
/// Returns:
///     dict with keys ``pos`` (pointer position or None; while dragging it is reported
///     even outside the image, so it can be out of bounds), ``press_origin`` (where the
///     primary button was pressed, or None), ``hovered``, ``clicked``, ``drag_started``,
///     ``dragged``, ``drag_stopped`` (bools) and ``scale`` (screen pixels per texture pixel).
///
/// Example::
///
///     r = canvas("photo", stroke=points, stroke_width=4, cursor_radius=2)
///     if r["dragged"]:
///         points.append(r["pos"])
#[pyfunction]
#[pyo3(signature = (
    texture,
    max_width=None,
    max_height=None,
    max_scale=1.0,
    selection=None,
    stroke=None,
    stroke_color=(0.0, 0.0, 0.0),
    stroke_width=1.0,
    cursor_radius=None,
))]
pub unsafe fn canvas<'py>(
    py: Python<'py>,
    texture: &str,
    max_width: Option<f32>,
    max_height: Option<f32>,
    max_scale: f32,
    selection: Option<(f32, f32, f32, f32)>,
    stroke: Option<Vec<(f32, f32)>>,
    stroke_color: (f32, f32, f32),
    stroke_width: f32,
    cursor_radius: Option<f32>,
) -> PyResult<Bound<'py, PyDict>> {
    let ui = current_ui(&UI)?;
    let handle = TEXTURES
        .lock()
        .unwrap()
        .get(texture)
        .cloned()
        .ok_or_else(|| {
            PyKeyError::new_err(format!("no texture '{texture}', call set_texture first"))
        })?;

    let [w, h] = handle.size();
    let image_size = egui::vec2(w as f32, h as f32);
    let available = ui.available_size();
    let max_w = max_width.unwrap_or(available.x).min(available.x);
    let max_h = max_height.unwrap_or(available.y).min(available.y);
    let mut scale = (max_w / image_size.x).min(max_h / image_size.y).min(max_scale);
    if !scale.is_finite() || scale <= 0.0 {
        scale = max_scale;
    }

    let (rect, response) =
        ui.allocate_exact_size(image_size * scale, egui::Sense::click_and_drag());
    let painter = ui.painter_at(rect);
    let to_screen = |(x, y): (f32, f32)| rect.min + egui::vec2(x, y) * scale;
    let to_image = |p: egui::Pos2| {
        let v = (p - rect.min) / scale;
        (v.x, v.y)
    };

    painter.image(
        handle.id(),
        rect,
        egui::Rect::from_min_max(egui::pos2(0.0, 0.0), egui::pos2(1.0, 1.0)),
        egui::Color32::WHITE,
    );

    if let Some((x0, y0, x1, y1)) = selection {
        let r = egui::Rect::from_two_pos(to_screen((x0, y0)), to_screen((x1, y1)));
        painter.rect_filled(r, 0.0, egui::Color32::from_white_alpha(40));
        painter.rect_stroke(
            r,
            0.0,
            egui::Stroke::new(1.5_f32, egui::Color32::YELLOW),
            egui::StrokeKind::Middle,
        );
    }

    if let Some(points) = stroke {
        let (r, g, b) = stroke_color;
        let color = egui::Color32::from(egui::Rgba::from_rgb(r, g, b));
        let width = stroke_width * scale;
        let points: Vec<egui::Pos2> = points.into_iter().map(to_screen).collect();
        if points.len() > 1 {
            painter.add(egui::Shape::line(
                points.clone(),
                egui::Stroke::new(width, color),
            ));
        }
        // round caps and joins
        for p in points {
            painter.circle_filled(p, width / 2.0, color);
        }
    }

    let hover = response.hover_pos();
    if let (Some(radius), Some(p)) = (cursor_radius, hover) {
        painter.circle_stroke(
            p,
            (radius * scale).max(1.0),
            egui::Stroke::new(1.0_f32, ui.visuals().text_color()),
        );
    }

    let pos = response.interact_pointer_pos().or(hover).map(to_image);
    let press_origin = ui.input(|i| i.pointer.press_origin()).map(to_image);

    let result = PyDict::new(py);
    result.set_item("pos", pos)?;
    result.set_item("press_origin", press_origin)?;
    result.set_item("hovered", response.hovered())?;
    result.set_item("clicked", response.clicked())?;
    result.set_item("drag_started", response.drag_started())?;
    result.set_item("dragged", response.dragged())?;
    result.set_item("drag_stopped", response.drag_stopped())?;
    result.set_item("scale", scale)?;
    Ok(result)
}

/// Show a modal dialog on top of the whole app while ``open.value`` is True.
///
/// Clicking outside the dialog or pressing Escape sets ``open.value`` to False.
/// The update function can close it by setting ``open.value = False`` as well.
///
/// Example::
///
///     dialog_open = Bool(False)
///
///     def dialog():
///         heading("Are you sure?")
///         if button_clicked("Close"):
///             dialog_open.value = False
///
///     # inside update_func
///     if button_clicked("Open dialog"):
///         dialog_open.value = True
///     modal("confirm", dialog_open, dialog)
#[pyfunction]
pub unsafe fn modal(
    py: Python<'_>,
    id: &str,
    open: Py<Bool>,
    update_fun: Bound<'_, PyAny>,
) -> PyResult<()> {
    if !open.borrow(py).value {
        return Ok(());
    }
    let ctx = current_ui(&UI)?.ctx().clone();
    let response =
        egui::Modal::new(egui::Id::new(id)).show(&ctx, |ui| run_nested_update_func(ui, update_fun));
    let should_close = response.should_close();
    response.inner?;
    if should_close {
        open.borrow_mut(py).value = false;
    }
    Ok(())
}

pub fn register(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(set_texture, m)?)?;
    m.add_function(wrap_pyfunction!(free_texture, m)?)?;
    m.add_function(wrap_pyfunction!(canvas, m)?)?;
    m.add_function(wrap_pyfunction!(modal, m)?)?;
    Ok(())
}
