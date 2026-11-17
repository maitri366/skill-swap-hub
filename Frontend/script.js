
// ==========================================
// SKILL SWAP HUB - FRONTEND INTEGRATION
// ==========================================

const API = "https://skill-swap-backend-h7jp.onrender.com/api";
let users = [];
let currentUser = JSON.parse(localStorage.getItem("skillSwapUser") || "null");

// ------------------------------------------
// DISPLAY USERS FROM DATABASE
// ------------------------------------------

function displayUsers(userList) {
    const container = document.getElementById("userContainer");
    container.innerHTML = "";

    if (userList.length === 0) {
        container.textContent = "No skill matches found.";
        return;
    }

    userList.forEach(user => {
        const card = document.createElement("div");
        card.className = "user-card";

        const avatar = document.createElement("div");
        avatar.className = "user-avatar";
        avatar.textContent = user.name.charAt(0).toUpperCase();

        const heading = document.createElement("h3");
        heading.textContent = user.name;

        const teach = document.createElement("p");
        teach.className = "skill-info";
        teach.textContent = "Can Teach: " + user.teaches;

        const learn = document.createElement("p");
        learn.className = "skill-info";
        learn.textContent = "Wants to Learn: " + user.wantsToLearn;

        const button = document.createElement("button");
        button.className = "connect-button";
        button.textContent = "Connect";

        button.addEventListener("click", () => connectUser(user));

        card.append(avatar, heading, teach, learn, button);
        container.appendChild(card);
    });
}

// ------------------------------------------
// FETCH USERS AND THEIR SKILLS
// ------------------------------------------

async function loadUsers() {
    try {
        const response = await fetch(`${API}/dashboard/users`);

        if (!response.ok) {
            throw new Error("Unable to fetch users");
        }

        const registeredUsers = await response.json();

        const profiles = await Promise.all(
            registeredUsers.map(async user => {
                const response = await fetch(
                    `${API}/user-skills/${user._id}`
                );

                if (!response.ok) return null;

                const data = await response.json();
                const skills = data.skills || [];

                const offered = skills.find(s => s.type === "offered");
                const wanted = skills.find(s => s.type === "wanted");

                if (!offered || !wanted) return null;

                return {
                    id: user._id,
                    name: user.name,
                    teaches: offered.skill.name,
                    wantsToLearn: wanted.skill.name,
                    offeredSkillId: offered.skill._id,
                    wantedSkillId: wanted.skill._id
                };
            })
        );

        users = profiles.filter(Boolean);
        displayUsers(users);

    } catch (error) {
        console.error("Loading users:", error);
        document.getElementById("userContainer").textContent =
            "Unable to load users. Please refresh the page.";
    }
}

// ------------------------------------------
// SEARCH USERS
// ------------------------------------------

function searchSkills() {
    const searchText = document
        .getElementById("searchInput")
        .value.toLowerCase()
        .trim();

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchText) ||
        user.teaches.toLowerCase().includes(searchText) ||
        user.wantsToLearn.toLowerCase().includes(searchText)
    );

    displayUsers(filteredUsers);
}

// ------------------------------------------
// CONNECT / CREATE SWAP REQUEST
// ------------------------------------------

async function connectUser(user) {
    if (!currentUser) {
        alert("Please create your profile first before sending a swap request.");
        scrollToForm();
        return;
    }

    if (currentUser.id === user.id) {
        alert("You cannot send a request to yourself.");
        return;
    }

    if (!currentUser.offeredSkillId || !user.wantedSkillId) {
        alert("Required skill information is unavailable.");
        return;
    }

    try {
        const response = await fetch(`${API}/swaps`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                requester: currentUser.id,
                receiver: user.id,
                offeredSkill: currentUser.offeredSkillId,
                requestedSkill: user.wantedSkillId,
                message: "I would like to exchange skills with you."
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Request failed");
        }

        alert("Skill swap request sent successfully!");

    } catch (error) {
        alert(error.message);
    }
}

// ------------------------------------------
// SCROLL TO REGISTRATION FORM
// ------------------------------------------

function scrollToForm() {
    document.getElementById("share-skill").scrollIntoView({
        behavior: "smooth"
    });
}

// ------------------------------------------
// CREATE SKILL IN DATABASE
// ------------------------------------------

async function createSkill(name, userId) {
    const response = await fetch(`${API}/skills`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: name,
            category: "General",
            description: "",
            createdBy: userId
        })
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Could not create skill");
    }

    return result.skill;
}

// ------------------------------------------
// LINK SKILL WITH USER
// ------------------------------------------

async function addUserSkill(userId, skillId, type) {
    const response = await fetch(`${API}/user-skills`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            userId: userId,
            skillId: skillId,
            proficiency: "beginner",
            type: type
        })
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Could not add user skill");
    }

    return result.userSkill;
}

// ------------------------------------------
// REGISTER USER AND SAVE SKILLS
// ------------------------------------------

document.getElementById("skillForm").addEventListener(
    "submit",
    async function(event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const teaches = document.getElementById("teachSkill").value.trim();
        const wantsToLearn = document.getElementById("learnSkill").value.trim();

        if (password.length < 8) {
            alert("Password must contain at least 8 characters.");
            return;
        }

        if (teaches.toLowerCase() === wantsToLearn.toLowerCase()) {
            alert("Please enter two different skills.");
            return;
        }

        const submitButton = event.target.querySelector(
            'button[type="submit"]'
        );

        submitButton.disabled = true;
        submitButton.textContent = "Saving...";

        try {
            // 1. Register user
            const registerResponse = await fetch(`${API}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name, email, password })
            });

            const registerResult = await registerResponse.json();

            if (!registerResponse.ok) {
                throw new Error(
                    registerResult.message || "Registration failed"
                );
            }

            const userId = registerResult.user.id;

            // 2. Create both skills
            const offeredSkill = await createSkill(teaches, userId);
            const wantedSkill = await createSkill(wantsToLearn, userId);

            // 3. Link skills to user
            await addUserSkill(userId, offeredSkill._id, "offered");
            await addUserSkill(userId, wantedSkill._id, "wanted");

            // 4. Save current user's profile locally
            currentUser = {
                id: userId,
                name: name,
                email: email,
                offeredSkillId: offeredSkill._id,
                wantedSkillId: wantedSkill._id
            };

            localStorage.setItem(
                "skillSwapUser",
                JSON.stringify(currentUser)
            );

            alert("Your profile and skills have been saved successfully!");

            event.target.reset();

            await loadUsers();

            document.getElementById("skills").scrollIntoView({
                behavior: "smooth"
            });

        } catch (error) {
            console.error("Registration error:", error);
            alert(error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Add My Profile";
        }
    }
);

// ------------------------------------------
// LOAD DATABASE USERS WHEN PAGE OPENS
// ------------------------------------------

loadUsers();

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("skillSearchInput");
  const dropdown = document.getElementById("searchDropdown");

  if (!searchInput || !dropdown) return;

  // 1. Dynamically sabhi profile cards dhundhne ka smart function (bina class name par depend kiye)
  function getProfileCards() {
    const allElements = document.querySelectorAll("div, article, section");
    const cards = [];

    allElements.forEach((el) => {
      // Sirf wahi smallest container pick karein jisme "Can Teach:" aur "Wants to Learn:" dono likhe hain
      const text = el.innerText || "";
      if (text.includes("Can Teach:") && text.includes("Wants to Learn:")) {
        // Check karein ki iske kisi child ke paas yeh dono text na hon (taaki parent grid container select na ho)
        const hasChildCard = Array.from(el.children).some(
          (child) =>
            (child.innerText || "").includes("Can Teach:") &&
            (child.innerText || "").includes("Wants to Learn:")
        );
        if (!hasChildCard) {
          cards.push(el);
        }
      }
    });

    return cards;
  }

  // 2. Cards se saari unique skills nikal kar alphabetically sort karna
  function getSortedAvailableSkills() {
    const skillsMap = new Map(); // Case-insensitive uniqueness ke liye (e.g. "java" aur "Java" ek hi maane jayein)
    const cards = getProfileCards();

    cards.forEach((card) => {
      const lines = card.innerText.split("\n");
      lines.forEach((line) => {
        if (line.includes("Can Teach:")) {
          const skill = line.split("Can Teach:")[1].trim();
          if (skill) skillsMap.set(skill.toLowerCase(), skill);
        }
        if (line.includes("Wants to Learn:")) {
          const skill = line.split("Wants to Learn:")[1].trim();
          if (skill) skillsMap.set(skill.toLowerCase(), skill);
        }
      });
    });

    // Alphabetical sorting (A to Z)
    return Array.from(skillsMap.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }

  // 3. Profiles ko filter karne ka function (Enter dabane ya Dropdown select karne par chalega)
  function filterProfilesBySkill(selectedSkill) {
    const query = selectedSkill.toLowerCase().trim();
    const cards = getProfileCards();

    cards.forEach((card) => {
      if (!query) {
        card.style.display = ""; // Agar search box khali hai toh sabhi cards dikhayein
        return;
      }

      let teachSkill = "";
      let learnSkill = "";
      const lines = card.innerText.split("\n");

      lines.forEach((line) => {
        if (line.includes("Can Teach:")) {
          teachSkill = line.split("Can Teach:")[1].trim().toLowerCase();
        }
        if (line.includes("Wants to Learn:")) {
          learnSkill = line.split("Wants to Learn:")[1].trim().toLowerCase();
        }
      });

      // Exact ya partial match check karein
      if (teachSkill.includes(query) || learnSkill.includes(query)) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  }

  // 4. Dropdown render aur sort karne ka function
  function updateDropdown(query) {
    const allSkills = getSortedAvailableSkills();
    const cleanQuery = query.toLowerCase().trim();

    // Agar query empty hai toh SAARI available skills dikhayein
    // Agar query typed hai (jaise "J") toh sirf us letter se START hone wali skills dikhayein
    const matchedSkills = cleanQuery === ""
      ? allSkills
      : allSkills.filter((skill) => skill.toLowerCase().startsWith(cleanQuery));

    dropdown.innerHTML = "";

    if (matchedSkills.length === 0) {
      dropdown.innerHTML = `<div class="dropdown-item" style="color:#9ca3af; cursor:default;">No matching skills found</div>`;
    } else {
      matchedSkills.forEach((skill) => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.innerHTML = `<span>${skill}</span> <span class="dropdown-badge">Skill</span>`;

        // Dropdown ke kisi skill par click karne par
        item.addEventListener("click", () => {
          searchInput.value = skill;
          filterProfilesBySkill(skill);
          dropdown.classList.add("hidden");
        });

        dropdown.appendChild(item);
      });
    }

    dropdown.classList.remove("hidden");
  }

  // --- Event Listeners ---

  // Search box par click ya focus karte hi saari available skills dikhayein
  searchInput.addEventListener("focus", () => {
    updateDropdown(searchInput.value);
  });

  searchInput.addEventListener("click", () => {
    updateDropdown(searchInput.value);
  });

  // Type karte waqt dropdown filter/sort karein
  searchInput.addEventListener("input", (e) => {
    const val = e.target.value;
    updateDropdown(val);

    // Agar user ne poora text delete kar diya hai toh saare cards wapas dikha dein
    if (val.trim() === "") {
      filterProfilesBySkill("");
    }
  });

  // ENTER key dabane par profiles filter karein aur dropdown band karein
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Form submit/page reload rokne ke liye
      filterProfilesBySkill(searchInput.value);
      dropdown.classList.add("hidden");
    }
  });

  // Search box ke bahar click karne par dropdown band karein
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrapper")) {
      dropdown.classList.add("hidden");
    }
  });
});