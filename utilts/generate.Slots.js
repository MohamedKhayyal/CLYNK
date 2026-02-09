const generateSlots = (from, to, duration = 30) => {
  const slots = [];
  let start = new Date(`1970-01-01T${from}`);
  const end = new Date(`1970-01-01T${to}`);

  while (start < end) {
    const fromTime = start.toTimeString().slice(0, 5);
    start.setMinutes(start.getMinutes() + duration);
    const toTime = start.toTimeString().slice(0, 5);

    if (start <= end) {
      slots.push({ from: fromTime, to: toTime });
    }
  }
  return slots;
};
module.exports = generateSlots;
