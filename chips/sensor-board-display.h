#ifndef SENSOR_BOARD_DISPLAY_H
#define SENSOR_BOARD_DISPLAY_H

#include "wokwi-api.h"

#include <stdint.h>

#define SENSOR_BOARD_WIDTH 112
#define SENSOR_BOARD_HEIGHT 73

typedef struct {
  uint8_t red;
  uint8_t green;
  uint8_t blue;
  uint8_t alpha;
} sensor_pixel_t;

static sensor_pixel_t sensor_pixels[SENSOR_BOARD_WIDTH * SENSOR_BOARD_HEIGHT];

static sensor_pixel_t sensor_color(
    uint8_t red,
    uint8_t green,
    uint8_t blue) {
  const sensor_pixel_t color = {red, green, blue, 255};
  return color;
}

static void sensor_fill_rect(
    int left,
    int top,
    int width,
    int height,
    sensor_pixel_t color) {
  for (int y = top; y < top + height; y++) {
    if (y < 0 || y >= SENSOR_BOARD_HEIGHT) continue;
    for (int x = left; x < left + width; x++) {
      if (x < 0 || x >= SENSOR_BOARD_WIDTH) continue;
      sensor_pixels[y * SENSOR_BOARD_WIDTH + x] = color;
    }
  }
}

static void sensor_fill_circle(
    int center_x,
    int center_y,
    int radius,
    sensor_pixel_t color) {
  const int squared_radius = radius * radius;
  for (int y = center_y - radius; y <= center_y + radius; y++) {
    for (int x = center_x - radius; x <= center_x + radius; x++) {
      const int dx = x - center_x;
      const int dy = y - center_y;
      if (dx * dx + dy * dy <= squared_radius) {
        sensor_fill_rect(x, y, 1, 1, color);
      }
    }
  }
}

static void sensor_draw_trace(
    int left,
    int top,
    int width,
    int height) {
  sensor_fill_rect(
      left,
      top,
      width,
      height,
      sensor_color(205, 163, 73));
}

static void sensor_draw_mounting_holes(void) {
  const sensor_pixel_t ring = sensor_color(222, 190, 92);
  const sensor_pixel_t hole = sensor_color(38, 43, 48);
  sensor_fill_circle(9, 9, 6, ring);
  sensor_fill_circle(102, 9, 6, ring);
  sensor_fill_circle(9, 63, 6, ring);
  sensor_fill_circle(102, 63, 6, ring);
  sensor_fill_circle(9, 9, 3, hole);
  sensor_fill_circle(102, 9, 3, hole);
  sensor_fill_circle(9, 63, 3, hole);
  sensor_fill_circle(102, 63, 3, hole);
}

static void sensor_draw_header(void) {
  const sensor_pixel_t gold = sensor_color(224, 170, 61);
  const sensor_pixel_t dark = sensor_color(30, 34, 38);
  for (int index = 0; index < 4; index++) {
    const int x = 39 + index * 11;
    sensor_fill_rect(x, 61, 8, 10, dark);
    sensor_fill_rect(x + 2, 61, 4, 9, gold);
  }
}

static void sensor_draw_ina219_board(buffer_t framebuffer) {
  const sensor_pixel_t board = sensor_color(20, 91, 149);
  const sensor_pixel_t silk = sensor_color(226, 239, 245);
  const sensor_pixel_t chip = sensor_color(25, 28, 31);
  const sensor_pixel_t silver = sensor_color(207, 211, 211);
  const sensor_pixel_t terminal = sensor_color(31, 112, 62);

  sensor_fill_rect(0, 0, SENSOR_BOARD_WIDTH, SENSOR_BOARD_HEIGHT, board);
  sensor_draw_mounting_holes();
  sensor_draw_trace(22, 17, 31, 2);
  sensor_draw_trace(52, 18, 2, 22);
  sensor_draw_trace(55, 39, 31, 2);
  sensor_fill_rect(44, 27, 25, 19, chip);
  sensor_fill_rect(47, 30, 19, 13, sensor_color(39, 43, 47));
  sensor_fill_rect(73, 20, 27, 15, silver);
  sensor_fill_rect(76, 23, 21, 9, sensor_color(172, 178, 178));
  sensor_fill_rect(17, 22, 18, 25, terminal);
  sensor_fill_rect(20, 25, 12, 7, sensor_color(62, 148, 86));
  sensor_fill_rect(20, 36, 12, 7, sensor_color(62, 148, 86));
  sensor_fill_rect(42, 11, 35, 3, silk);
  sensor_fill_rect(82, 48, 16, 3, silk);
  sensor_draw_header();
  buffer_write(
      framebuffer,
      0,
      sensor_pixels,
      sizeof(sensor_pixels));
}

static void sensor_draw_tsl2591_board(buffer_t framebuffer) {
  const sensor_pixel_t board = sensor_color(18, 24, 31);
  const sensor_pixel_t silk = sensor_color(224, 226, 220);
  const sensor_pixel_t gold = sensor_color(218, 170, 67);
  const sensor_pixel_t chip = sensor_color(38, 40, 39);

  sensor_fill_rect(0, 0, SENSOR_BOARD_WIDTH, SENSOR_BOARD_HEIGHT, board);
  sensor_draw_mounting_holes();
  sensor_draw_trace(22, 20, 28, 2);
  sensor_draw_trace(48, 21, 2, 25);
  sensor_draw_trace(49, 44, 39, 2);
  sensor_fill_rect(42, 19, 31, 30, gold);
  sensor_fill_rect(46, 23, 23, 22, chip);
  sensor_fill_circle(57, 34, 8, sensor_color(12, 13, 14));
  sensor_fill_circle(57, 34, 5, sensor_color(72, 55, 86));
  sensor_fill_rect(79, 18, 15, 8, sensor_color(78, 81, 80));
  sensor_fill_rect(82, 20, 9, 4, sensor_color(185, 188, 182));
  sensor_fill_rect(18, 50, 17, 3, silk);
  sensor_fill_rect(76, 52, 23, 3, silk);
  sensor_draw_header();
  buffer_write(
      framebuffer,
      0,
      sensor_pixels,
      sizeof(sensor_pixels));
}

#endif
